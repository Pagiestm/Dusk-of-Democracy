import * as pc from 'playcanvas';
import { GameState, CollisionLayer, PLAYER_BASE_HP, PLAYER_BASE_SPEED, PLAYER_MAGNET_RADIUS } from '../constants';
import { PlayerStats, CharacterDef } from '../types';
import { InputManager } from './InputManager';
import { NetworkManager, FullSnapshot, EntitySnapshot, PlayerNetState, DamageEvent } from './NetworkManager';
import { setupScene } from './SceneSetup';
import { createPlayer } from '../entities/PlayerFactory';
import { createRemotePlayerVisual } from '../entities/RemotePlayerFactory';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { XPSystem } from '../systems/XPSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { CHARACTERS } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import { CameraFollow } from '../scripts/CameraFollow';
import { DayNightCycle } from '../scripts/DayNightCycle';
import { EnemyAI } from '../scripts/EnemyAI';
import { Health } from '../scripts/Health';
import { XPPickup } from '../scripts/XPPickup';
import { UIManager } from '../ui/UIManager';

const SNAPSHOT_INTERVAL = 1 / 30; // 30 Hz — smoother for clients

let nextNetId = 1;
function allocNetId(): number { return nextNetId++; }

export class Game {
    app: pc.Application;
    state: GameState = GameState.LOADING;
    inputManager: InputManager;
    network: NetworkManager;

    // Scene
    private cameraEntity: pc.Entity | null = null;
    private lightEntity: pc.Entity | null = null;
    private playerEntity: pc.Entity | null = null;

    // Multiplayer
    isMultiplayerGame: boolean = false;
    private snapshotTimer: number = 0;
    private hostDead: boolean = false;

    // Host: remote players (keyed by socket.id)
    private remotePlayerEntities: Map<string, pc.Entity> = new Map();
    private remotePlayerStats: Map<string, PlayerStats> = new Map();
    private remotePlayerAlive: Map<string, boolean> = new Map();
    private remotePlayerCharIds: Map<string, string> = new Map();
    private remotePlayerWeaponIds: Map<string, string> = new Map();
    private remotePlayerGold: Map<string, number> = new Map();
    private remotePlayerShopBought: Map<string, boolean> = new Map();
    private remotePlayerUpgrades: Map<string, UpgradeSystem> = new Map();
    private remotePlayerPendingLevelUps: Map<string, number> = new Map();
    private hostPendingLevelUps: number = 0;
    private pendingRemoteInputs: Map<string, { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }> = new Map();

    // Wave ready system (multiplayer)
    readyPlayers: Set<string> = new Set();

    // Damage events buffer (host → clients)
    private pendingDamageEvents: DamageEvent[] = [];

    // Client-side pending level-ups (from snapshot)
    private clientPendingLevelUps: number = 0;

    // Host: entity ↔ networkId mapping
    private entityNetIds: Map<pc.Entity, number> = new Map();
    private netIdEntities: Map<number, pc.Entity> = new Map();

    // Client: rendered entities from snapshots
    private clientEntities: Map<number, pc.Entity> = new Map();
    private clientPlayerEntities: Map<string, pc.Entity> = new Map();

    // Systems
    collisionSystem: CollisionSystem;
    combatSystem: CombatSystem;
    waveSystem: WaveSystem;
    xpSystem: XPSystem;
    upgradeSystem: UpgradeSystem;
    shopSystem: ShopSystem;

    // UI
    uiManager!: UIManager;

    // Player state
    playerStats: PlayerStats = this.defaultStats();
    selectedCharacter: CharacterDef | null = null;
    selectedWeaponId: string | null = null;
    gameTime: number = 0;
    killCount: number = 0;
    completedWave: number = 0;
    private hostKills: number = 0;
    private remotePlayerKills: Map<string, number> = new Map();
    private clientKills: number = 0;
    private clientLevel: number = 1;
    private clientXpProgress: number = 0;
    private clientGold: number = 0;

    get isHost(): boolean { return !this.isMultiplayerGame || this.network.isHost; }
    get isClient(): boolean { return this.isMultiplayerGame && !this.network.isHost; }

    constructor(app: pc.Application) {
        this.app = app;
        (app as any).__game = this;

        this.inputManager = new InputManager(app);
        this.network = new NetworkManager();

        this.collisionSystem = new CollisionSystem(this.handleCollision.bind(this));
        this.combatSystem = new CombatSystem(app);
        this.waveSystem = new WaveSystem(app);
        this.xpSystem = new XPSystem(app);
        this.upgradeSystem = new UpgradeSystem();
        this.shopSystem = new ShopSystem();

        app.on('update', this.update, this);

        this.setupEvents();
        this.setupNetworkCallbacks();
    }

    /** Must be called after constructor (UIManager needs Game reference) */
    initUI(): void {
        this.uiManager = new UIManager(this);
    }

    init(): void {
        const { camera, light } = setupScene(this.app);
        this.cameraEntity = camera;
        this.lightEntity = light;

        this.cameraEntity.addComponent('script');
        this.cameraEntity.script!.create(CameraFollow);

        this.lightEntity.addComponent('script');
        this.lightEntity.script!.create(DayNightCycle);

        this.initUI();
        this.setState(GameState.MAIN_MENU);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════

    private setupEvents(): void {
        this.app.on('enemy:died', (entity: pc.Entity, _xpReward: number) => {
            if (this.isClient) return;

            this.killCount++;

            // Attribute kill to the player who dealt the last hit
            const killerId = (entity as any).__lastAttacker as string | undefined;
            if (killerId) {
                if (killerId === this.network.myId) {
                    this.hostKills++;
                } else {
                    this.remotePlayerKills.set(killerId,
                        (this.remotePlayerKills.get(killerId) || 0) + 1);
                }
            } else if (!this.isMultiplayerGame) {
                this.hostKills++;
            }

            const goldReward = Math.floor(Math.random() * 5) + 1;
            this.shopSystem.addGold(goldReward);
            // Give gold to all remote players too
            for (const [pid] of this.remotePlayerGold) {
                this.remotePlayerGold.set(pid, (this.remotePlayerGold.get(pid) || 0) + goldReward);
            }
            this.collisionSystem.unregister(entity);

            const nid = this.entityNetIds.get(entity);
            if (nid !== undefined) {
                this.entityNetIds.delete(entity);
                this.netIdEntities.delete(nid);
            }

            setTimeout(() => { if (entity.parent) entity.destroy(); }, 50);
        });

        // Collect damage events for snapshot (host → clients)
        this.app.on('damage:dealt', (entity: any, damage: number, armorAbsorbed: boolean) => {
            if (!this.isHost || !this.isMultiplayerGame) return;
            if (!entity?.getPosition) return;
            const pos = entity.getPosition();
            this.pendingDamageEvents.push({ x: pos.x, z: pos.z, damage, armor: armorAbsorbed ?? false });
        });

        this.app.on('xp:collected', (_amount: number) => {
            // XPSystem handles it
        });

        this.app.on('player:levelup', (_level: number) => {
            if (this.state === GameState.PLAYING) {
                if (this.isMultiplayerGame && this.isHost) {
                    this.readyPlayers.clear();
                }
                // Pause the game for everyone (host sets state, clients follow via snapshot)
                this.setState(GameState.LEVEL_UP);
            }
        });

        this.app.on('wave:complete', (waveIndex: number) => {
            if (this.state === GameState.PLAYING) {
                this.completedWave = waveIndex;
                // Respawn dead players before wave-end shop
                if (this.isMultiplayerGame && this.isHost) {
                    this.respawnDeadPlayers();
                    this.readyPlayers.clear();
                    // Reset per-player shop bought flag
                    for (const pid of this.remotePlayerShopBought.keys()) {
                        this.remotePlayerShopBought.set(pid, false);
                    }
                }
                this.setState(GameState.WAVE_END);
            }
        });

        this.app.on('player:died', () => {
            if (this.isMultiplayerGame) {
                if (this.isHost) {
                    this.hostDead = true;
                    if (this.playerEntity) {
                        this.playerEntity.enabled = false;
                        this.collisionSystem.unregister(this.playerEntity);
                    }
                    // Switch camera to a surviving player
                    this.switchCameraToAlivePlayer();
                    if (this.areAllPlayersDead()) {
                        this.network.sendGameOver();
                        this.setState(GameState.GAME_OVER);
                    }
                }
                return;
            }
            this.setState(GameState.GAME_OVER);
        });
    }

    private setupNetworkCallbacks(): void {
        // Host: accumulate remote inputs
        this.network.onRemoteInput = (data) => {
            if (!this.isHost) return;
            this.pendingRemoteInputs.set(data.playerId, {
                moveX: data.moveX,
                moveZ: data.moveZ,
                aimX: data.aimX,
                aimZ: data.aimZ,
                fire: data.fire,
            });
        };

        // Client: receive snapshots from host
        this.network.onSnapshot = (snap: FullSnapshot) => {
            // Apply snapshot on any non-host client
            if (this.isMultiplayerGame && !this.network.isHost) {
                this.applySnapshot(snap);
            }
        };

        // Host starts selection → go to character select
        this.network.onStartSelection = () => {
            this.setState(GameState.CHARACTER_SELECT);
        };

        // All players ready → start game
        this.network.onGameStart = (players) => {
            const me = players.find(p => p.id === this.network.myId);
            if (me?.characterId && me?.weaponId) {
                this.isMultiplayerGame = true;
                this.startGame(me.characterId, me.weaponId);
            }
        };

        // Game over from host
        this.network.onGameOver = () => {
            this.setState(GameState.GAME_OVER);
        };

        // Host: remote player buys a shop item
        this.network.onRemoteBuyItem = (data) => {
            if (!this.isHost) return;
            this.handleRemoteBuy(data.playerId, data.itemId);
        };

        // Host: remote player picks an upgrade
        this.network.onRemoteSelectUpgrade = (data) => {
            if (!this.isHost) return;
            const stats = this.remotePlayerStats.get(data.playerId);
            const upgSys = this.remotePlayerUpgrades.get(data.playerId);
            if (stats && upgSys) {
                upgSys.applyUpgrade(data.upgradeId, stats);
                // Dead players keep HP at 0 — they'll respawn with full HP at wave end
                if (!this.remotePlayerAlive.get(data.playerId)) {
                    stats.hp = 0;
                }
            }
        };

        // Host: remote player marks ready
        this.network.onRemotePlayerReady = (data) => {
            if (!this.isHost) return;
            this.readyPlayers.add(data.playerId);
            if (this.state === GameState.WAVE_END) this.checkAllReady();
            if (this.state === GameState.LEVEL_UP) this.checkAllReady_LevelUp();
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════

    setState(newState: GameState): void {
        const oldState = this.state;
        this.state = newState;
        this.uiManager.onStateChange(oldState, newState);
    }

    selectCharacter(characterId: string): void {
        const charDef = CHARACTERS.find(c => c.id === characterId);
        if (!charDef) return;
        this.selectedCharacter = charDef;

        if (this.isMultiplayerGame) {
            this.network.selectCharacter(characterId);
        }

        this.setState(GameState.WEAPON_SELECT);
    }

    selectWeapon(weaponId: string): void {
        this.selectedWeaponId = weaponId;

        if (this.isMultiplayerGame) {
            // Send to server — game will start when all players are ready
            this.network.selectWeapon(weaponId);
        } else {
            // Solo: start immediately
            if (this.selectedCharacter) {
                this.startGame(this.selectedCharacter.id, weaponId);
            }
        }
    }

    startGame(characterId: string, weaponId: string): void {
        const charDef = CHARACTERS.find(c => c.id === characterId);
        if (!charDef) return;

        this.selectedCharacter = charDef;
        this.selectedWeaponId = weaponId;
        this.resetGame();

        this.playerStats = {
            maxHp: charDef.hp, hp: charDef.hp, speed: charDef.speed,
            damage: 1, cooldownMultiplier: 1, magnetRadius: PLAYER_MAGNET_RADIUS,
            armor: 0, maxArmor: 0, projectileCount: 0,
        };

        if (this.isClient) {
            // CLIENT: visual-only entity — NO scripts, NO physics
            // Position is driven entirely by host snapshots
            this.playerEntity = createRemotePlayerVisual(this.app, characterId);
            this.playerEntity.name = 'player';
        } else {
            // HOST or SOLO: full player with scripts (identical to solo)
            this.playerEntity = createPlayer(this.app, charDef);
            this.collisionSystem.register(this.playerEntity, 0.4, CollisionLayer.PLAYER);
            this.combatSystem.setPlayer(this.playerEntity);
            const weaponDef = WEAPONS.find(w => w.id === weaponId);
            if (weaponDef) this.combatSystem.addWeapon(weaponDef);

            if (this.isMultiplayerGame) this.spawnRemotePlayersOnHost();
        }

        const camFollow = this.cameraEntity?.script?.get('cameraFollow') as CameraFollow | undefined;
        if (camFollow) camFollow.setTarget(this.playerEntity);

        this.setState(GameState.PLAYING);
    }

    private spawnRemotePlayersOnHost(): void {
        for (const p of this.network.roomPlayers) {
            if (p.id === this.network.myId) continue;

            const charDef = CHARACTERS.find(c => c.id === p.characterId) || CHARACTERS[0];
            const charId = p.characterId || charDef.id;
            const wepId = p.weaponId || WEAPONS[0].id;

            const entity = createRemotePlayerVisual(this.app, charId);
            entity.name = `remote_player_${p.id}`;
            entity.tags.add('player');
            entity.tags.add('remote_player');
            (entity as any).__playerId = p.id;
            (entity as any).__characterId = charId;

            this.remotePlayerEntities.set(p.id, entity);
            this.remotePlayerAlive.set(p.id, true);
            this.remotePlayerCharIds.set(p.id, charId);
            this.remotePlayerWeaponIds.set(p.id, wepId);
            this.collisionSystem.register(entity, 0.4, CollisionLayer.PLAYER);

            const stats: PlayerStats = {
                maxHp: charDef.hp, hp: charDef.hp, speed: charDef.speed,
                damage: 1, cooldownMultiplier: 1, magnetRadius: PLAYER_MAGNET_RADIUS,
                armor: 0, maxArmor: 0, projectileCount: 0,
            };
            this.remotePlayerStats.set(p.id, stats);

            this.remotePlayerGold.set(p.id, 0);
            this.remotePlayerShopBought.set(p.id, false);
            this.remotePlayerUpgrades.set(p.id, new UpgradeSystem());
            this.remotePlayerPendingLevelUps.set(p.id, 0);
            this.remotePlayerKills.set(p.id, 0);

            const weaponDef = WEAPONS.find(w => w.id === wepId) || WEAPONS[0];
            this.combatSystem.addRemoteWeapon(p.id, weaponDef);
        }
    }

    /** Sync playerStats back to the entity's scripts (Health, PlayerController) */
    private syncStatsToEntity(): void {
        if (!this.playerEntity?.script) return;
        const controller = this.playerEntity.script.get('playerController') as any;
        if (controller) controller.speed = this.playerStats.speed;
        const health = this.playerEntity.script.get('health') as any;
        if (health) {
            health.maxHp = this.playerStats.maxHp;
            health.hp = this.playerStats.hp;
        }
    }

    selectUpgrade(upgradeId: string): void {
        if (this.isMultiplayerGame) {
            if (this.isClient) {
                // Client: send choice to host + apply locally
                this.network.sendSelectUpgrade(upgradeId);
            }
            // Apply upgrade (both host and client)
            this.upgradeSystem.applyUpgrade(upgradeId, this.playerStats);
            // Dead players keep HP at 0 — they'll respawn at wave end
            if (this.hostDead) {
                this.playerStats.hp = 0;
            }
            this.syncStatsToEntity();
            // Don't change state — player must click "PRET" via confirmLevelUp()
        } else {
            this.upgradeSystem.applyUpgrade(upgradeId, this.playerStats);
            this.syncStatsToEntity();
            this.setState(GameState.PLAYING);
        }
    }

    /** Multi: player confirms they're ready after picking their upgrade */
    confirmLevelUp(): void {
        if (this.state !== GameState.LEVEL_UP) return;
        if (!this.isMultiplayerGame) return;

        if (this.isHost) {
            this.readyPlayers.add(this.network.myId!);
            this.checkAllReady_LevelUp();
        } else {
            this.network.sendPlayerReady();
        }
    }

    /** Host: resume game when all players clicked PRET after level-up */
    private checkAllReady_LevelUp(): void {
        if (this.state !== GameState.LEVEL_UP) return;
        const totalPlayers = 1 + this.remotePlayerEntities.size;
        if (this.readyPlayers.size >= totalPlayers) {
            this.setState(GameState.PLAYING);
        }
    }

    buyItem(itemId: string): boolean {
        if (this.isMultiplayerGame && this.isClient) {
            // Client: send buy request to host
            this.network.sendBuyItem(itemId);
            return true; // optimistic — host will validate
        }
        const success = this.shopSystem.buy(itemId, this.playerStats);
        if (success) this.syncStatsToEntity();
        return success;
    }

    continueToNextWave(): void {
        if (this.state !== GameState.WAVE_END) return;

        if (this.isMultiplayerGame) {
            if (this.isHost) {
                // Host marks self as ready
                this.readyPlayers.add(this.network.myId!);
                this.checkAllReady();
            } else {
                // Client sends ready to host
                this.network.sendPlayerReady();
            }
        } else {
            this.setState(GameState.PLAYING);
        }
    }

    pauseGame(): void {
        if (this.state === GameState.PLAYING) this.setState(GameState.PAUSED);
    }

    resumeGame(): void {
        if (this.state === GameState.PAUSED) this.setState(GameState.PLAYING);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GAME LOOP
    // ═══════════════════════════════════════════════════════════════════

    private update(dt: number): void {
        if (this.state === GameState.PLAYING) {
            this.gameTime += dt;
            this.inputManager.update(this.playerEntity, this.cameraEntity);

            if (this.inputManager.getState().pause && !this.isMultiplayerGame) {
                this.pauseGame();
                return;
            }

            if (this.isHost) {
                this.registerNewEntities();

                if (this.isMultiplayerGame) {
                    this.applyRemoteInputs(dt);
                }

                this.collisionSystem.update();
                this.combatSystem.update(
                    dt,
                    this.playerStats.cooldownMultiplier,
                    this.playerStats.damage,
                    this.playerStats.projectileCount
                );
                this.waveSystem.update(dt);
                this.uiManager.updateHUD();

                if (this.isMultiplayerGame) {
                    this.checkRemotePlayerDeaths();

                    this.snapshotTimer += dt;
                    if (this.snapshotTimer >= SNAPSHOT_INTERVAL) {
                        this.snapshotTimer = 0;
                        this.broadcastSnapshot();
                    }
                }
            } else {
                // CLIENT: prediction + interpolation + send input
                this.updateClientPrediction(dt);
                this.interpolateClientEntities(dt);

                const input = this.inputManager.getState();
                this.network.sendInput({
                    moveX: input.moveDirection.x,
                    moveZ: input.moveDirection.y,
                    aimX: input.aimDirection.x,
                    aimZ: input.aimDirection.y,
                    fire: false,
                });
                this.uiManager.updateHUD();
            }
        } else if (this.state === GameState.PAUSED || this.state === GameState.LEVEL_UP || this.state === GameState.WAVE_END) {
            this.inputManager.update(this.playerEntity, this.cameraEntity);
            if (this.state === GameState.PAUSED && this.inputManager.getState().pause) {
                this.resumeGame();
            }
            // Keep sending snapshots during WAVE_END/LEVEL_UP so clients see state updates
            if ((this.state === GameState.WAVE_END || this.state === GameState.LEVEL_UP) && this.isMultiplayerGame && this.isHost) {
                this.snapshotTimer += dt;
                if (this.snapshotTimer >= SNAPSHOT_INTERVAL) {
                    this.snapshotTimer = 0;
                    this.broadcastSnapshot();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CLIENT: PREDICTION & INTERPOLATION
    // ═══════════════════════════════════════════════════════════════════

    /** Client-side prediction: move local player instantly based on input */
    private updateClientPrediction(dt: number): void {
        if (!this.playerEntity || !this.playerEntity.enabled || this.hostDead) return;

        const input = this.inputManager.getState();
        const speed = this.playerStats.speed || PLAYER_BASE_SPEED;
        const moveLen = Math.sqrt(input.moveDirection.x ** 2 + input.moveDirection.y ** 2);
        if (moveLen > 0) {
            const nx = input.moveDirection.x / moveLen;
            const nz = input.moveDirection.y / moveLen;
            const pos = this.playerEntity.getPosition();
            this.playerEntity.setPosition(
                Math.max(-39, Math.min(39, pos.x + nx * speed * dt)),
                pos.y,
                Math.max(-39, Math.min(39, pos.z + nz * speed * dt))
            );
        }
        if (input.aimDirection.x !== 0 || input.aimDirection.y !== 0) {
            const angle = Math.atan2(input.aimDirection.x, input.aimDirection.y) * (180 / Math.PI);
            this.playerEntity.setEulerAngles(0, angle, 0);
        }
    }

    /** Smoothly interpolate all client-side entities toward their target positions */
    private interpolateClientEntities(dt: number): void {
        const lerpSpeed = 18; // Higher = snappier
        const t = Math.min(1, lerpSpeed * dt);

        // Interpolate other players
        for (const [, entity] of this.clientPlayerEntities) {
            if (!entity.enabled) continue;
            const tx = (entity as any).__targetX;
            const tz = (entity as any).__targetZ;
            const ta = (entity as any).__targetAngle;
            if (tx === undefined) continue;
            const pos = entity.getPosition();
            entity.setPosition(
                pos.x + (tx - pos.x) * t,
                0.5,
                pos.z + (tz - pos.z) * t
            );
            if (ta !== undefined) {
                const cur = entity.getEulerAngles();
                entity.setEulerAngles(0, cur.y + this.angleDiff(cur.y, ta) * t, 0);
            }
        }

        // Interpolate entities (enemies, projectiles, pickups)
        const pickupBob = Math.sin(this.gameTime * 4) * 0.15;
        for (const [, entity] of this.clientEntities) {
            const tx = (entity as any).__targetX;
            const tz = (entity as any).__targetZ;
            const ty = (entity as any).__targetY;
            const etype = (entity as any).__entityType;
            if (tx === undefined) continue;

            const pos = entity.getPosition();
            const finalY = etype === 'pickup' ? (ty ?? 0.3) + pickupBob : (ty ?? pos.y);
            entity.setPosition(
                pos.x + (tx - pos.x) * t,
                finalY,
                pos.z + (tz - pos.z) * t
            );

            // Spin pickups
            if (etype === 'pickup') {
                const rot = entity.getEulerAngles();
                entity.setEulerAngles(45, rot.y + 120 * dt, 0);
            }
        }
    }

    /** Shortest angle difference (handles wrap-around) */
    private angleDiff(from: number, to: number): number {
        let d = ((to - from) % 360 + 540) % 360 - 180;
        return d;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: REMOTE INPUT
    // ═══════════════════════════════════════════════════════════════════

    private applyRemoteInputs(dt: number): void {
        for (const [playerId, data] of this.pendingRemoteInputs) {
            const entity = this.remotePlayerEntities.get(playerId);
            if (!entity) continue;

            // Use alive flag (not HP) — HP can be restored by upgrades while still dead
            if (!this.remotePlayerAlive.get(playerId)) continue;

            const stats = this.remotePlayerStats.get(playerId);

            const speed = stats?.speed || PLAYER_BASE_SPEED;

            const pos = entity.getPosition();
            const len = Math.sqrt(data.moveX * data.moveX + data.moveZ * data.moveZ);
            if (len > 0) {
                const nx = data.moveX / len;
                const nz = data.moveZ / len;
                entity.setPosition(
                    Math.max(-39, Math.min(39, pos.x + nx * speed * dt)),
                    pos.y,
                    Math.max(-39, Math.min(39, pos.z + nz * speed * dt))
                );
            }

            if (data.aimX !== 0 || data.aimZ !== 0) {
                const angle = Math.atan2(data.aimX, data.aimZ) * (180 / Math.PI);
                entity.setEulerAngles(0, angle, 0);
            }

            // Auto-fire: remote players fire automatically (same as local player)
            this.combatSystem.fireForRemotePlayer(
                entity,
                data.aimX, data.aimZ,
                stats?.damage || 1,
                stats?.projectileCount || 0
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CLIENT: LOCAL FIRE PREDICTION
    // ═══════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: SNAPSHOT BROADCAST
    // ═══════════════════════════════════════════════════════════════════

    private broadcastSnapshot(): void {
        if (!this.playerEntity) return;

        const pos = this.playerEntity.getPosition();
        const ang = this.playerEntity.getEulerAngles();
        // Global level & XP progress (shared by all)
        const globalLevel = this.xpSystem.currentLevel;
        const globalXpProgress = this.xpSystem.getProgress();

        const players: PlayerNetState[] = [{
            id: this.network.myId!,
            characterId: this.selectedCharacter?.id || 'trump',
            alive: !this.hostDead,
            level: globalLevel,
            xpProgress: globalXpProgress,
            gold: this.shopSystem.gold,
            kills: this.hostKills,
            pendingLevelUps: this.hostPendingLevelUps,
            x: pos.x, z: pos.z, angle: ang.y,
            hp: this.playerStats.hp, maxHp: this.playerStats.maxHp,
            armor: this.playerStats.armor, maxArmor: this.playerStats.maxArmor,
            speed: this.playerStats.speed,
        }];

        for (const [playerId, entity] of this.remotePlayerEntities) {
            const rp = entity.getPosition();
            const ra = entity.getEulerAngles();
            const stats = this.remotePlayerStats.get(playerId);
            const alive = this.remotePlayerAlive.get(playerId) ?? true;
            players.push({
                id: playerId,
                characterId: (entity as any).__characterId || 'trump',
                alive,
                level: globalLevel,
                xpProgress: globalXpProgress,
                gold: this.remotePlayerGold.get(playerId) ?? 0,
                kills: this.remotePlayerKills.get(playerId) ?? 0,
                pendingLevelUps: this.remotePlayerPendingLevelUps.get(playerId) ?? 0,
                x: rp.x, z: rp.z, angle: ra.y,
                hp: stats?.hp ?? 100, maxHp: stats?.maxHp ?? 100,
                armor: stats?.armor ?? 0, maxArmor: stats?.maxArmor ?? 0,
                speed: stats?.speed ?? 8,
            });
        }

        const entities: EntitySnapshot[] = [];

        for (const e of this.app.root.findByTag('enemy') as pc.Entity[]) {
            let nid = this.entityNetIds.get(e);
            if (nid === undefined) { nid = allocNetId(); this.entityNetIds.set(e, nid); this.netIdEntities.set(nid, e); }
            const ep = e.getPosition();
            const def = (e as any).__enemyDef;
            const health = e.script?.get('health') as any;
            entities.push({ nid, type: 'enemy', defId: def?.id || 'basic', x: ep.x, z: ep.z, hp: health?.hp ?? 0, maxHp: health?.maxHp ?? 20, scale: def?.scale ?? 0.8 });
        }

        for (const p of this.app.root.findByTag('player_projectile') as pc.Entity[]) {
            let nid = this.entityNetIds.get(p);
            if (nid === undefined) { nid = allocNetId(); this.entityNetIds.set(p, nid); this.netIdEntities.set(nid, p); }
            const pp = p.getPosition();
            entities.push({ nid, type: 'projectile', x: pp.x, z: pp.z });
        }

        for (const pk of this.app.root.findByTag('xp_pickup') as pc.Entity[]) {
            let nid = this.entityNetIds.get(pk);
            if (nid === undefined) { nid = allocNetId(); this.entityNetIds.set(pk, nid); this.netIdEntities.set(nid, pk); }
            const pkp = pk.getPosition();
            entities.push({ nid, type: 'pickup', x: pkp.x, z: pkp.z });
        }

        // Area effects (shockwaves)
        for (const ae of this.app.root.findByTag('area_effect') as pc.Entity[]) {
            let nid = this.entityNetIds.get(ae);
            if (nid === undefined) { nid = allocNetId(); this.entityNetIds.set(ae, nid); this.netIdEntities.set(nid, ae); }
            const aep = ae.getPosition();
            const s = ae.getLocalScale();
            entities.push({ nid, type: 'area_effect', x: aep.x, z: aep.z, scale: s.x });
        }

        this.network.sendSnapshot({
            tick: Math.floor(this.gameTime * 20),
            gameTime: this.gameTime,
            wave: this.waveSystem.currentWave,
            nightFactor: (this.app as any).__nightFactor ?? 0,
            timeOfDay: (this.app as any).__timeOfDay ?? 0,
            killCount: this.killCount,
            completedWave: this.completedWave,
            state: this.state,
            readyPlayers: Array.from(this.readyPlayers),
            players,
            entities,
            damageEvents: this.pendingDamageEvents,
        });
        this.pendingDamageEvents = [];
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CLIENT: APPLY SNAPSHOT
    // ═══════════════════════════════════════════════════════════════════

    private applySnapshot(snap: FullSnapshot): void {
        this.gameTime = snap.gameTime;
        this.killCount = snap.killCount;
        this.waveSystem.currentWave = snap.wave;
        this.completedWave = snap.completedWave ?? this.completedWave;
        (this.app as any).__nightFactor = snap.nightFactor;
        (this.app as any).__timeOfDay = snap.timeOfDay;

        // Sync ready players list
        this.readyPlayers = new Set(snap.readyPlayers || []);

        // Sync game state from host (PLAYING ↔ WAVE_END ↔ LEVEL_UP transitions)
        const hostState = snap.state as GameState;
        if (hostState && hostState !== this.state) {
            const allowed: GameState[] = [GameState.PLAYING, GameState.WAVE_END, GameState.LEVEL_UP];
            if (allowed.includes(hostState) && allowed.includes(this.state)) {
                this.setState(hostState);
            }
        }

        // Update local player from host's authoritative state
        const myState = snap.players.find(p => p.id === this.network.myId);
        if (myState && this.playerEntity) {
            // Handle death/respawn via snapshot
            if (!myState.alive && !this.hostDead) {
                this.playerEntity.enabled = false;
                this.hostDead = true;
                this.switchCameraToAlivePlayer();
            } else if (this.hostDead && myState.alive) {
                // Respawned!
                this.playerEntity.enabled = true;
                this.hostDead = false;
                this.restoreCameraToSelf();
            }

            if (myState.alive) {
                // Store server position for reconciliation (client-side prediction handles movement)
                const currentPos = this.playerEntity.getPosition();
                const dx = myState.x - currentPos.x;
                const dz = myState.z - currentPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > 3.0) {
                    // Too far from server — snap to correct position
                    this.playerEntity.setPosition(myState.x, 0.5, myState.z);
                } else if (dist > 0.1) {
                    // Gentle correction toward server position
                    this.playerEntity.setPosition(
                        currentPos.x + dx * 0.3,
                        0.5,
                        currentPos.z + dz * 0.3
                    );
                }
            }
            this.playerStats.hp = myState.hp;
            this.playerStats.maxHp = myState.maxHp;
            this.playerStats.speed = myState.speed;
            this.playerStats.armor = myState.armor;
            this.playerStats.maxArmor = myState.maxArmor;
            this.clientLevel = myState.level;
            this.clientXpProgress = myState.xpProgress;
            this.clientGold = myState.gold;
            this.clientKills = myState.kills;
            this.clientPendingLevelUps = myState.pendingLevelUps ?? 0;
        }

        // Update other players
        const activePlayerIds = new Set<string>();
        for (const pState of snap.players) {
            if (pState.id === this.network.myId) continue;
            activePlayerIds.add(pState.id);

            let entity = this.clientPlayerEntities.get(pState.id);
            if (!entity) {
                entity = this.createClientPlayerEntity(pState.id, pState.characterId);
                this.clientPlayerEntities.set(pState.id, entity);
            }

            entity.enabled = pState.alive;

            if (pState.alive) {
                // Store targets for interpolation
                (entity as any).__targetX = pState.x;
                (entity as any).__targetZ = pState.z;
                (entity as any).__targetAngle = pState.angle;
                // Snap if first frame (no previous position set)
                if ((entity as any).__interpReady === undefined) {
                    entity.setPosition(pState.x, 0.5, pState.z);
                    entity.setEulerAngles(0, pState.angle, 0);
                    (entity as any).__interpReady = true;
                }
            }
        }

        // Remove dead remote players
        for (const [pid, entity] of this.clientPlayerEntities) {
            if (!activePlayerIds.has(pid)) {
                entity.destroy();
                this.clientPlayerEntities.delete(pid);
            }
        }

        // Entities
        const aliveNids = new Set<number>();

        for (const eSnap of snap.entities) {
            aliveNids.add(eSnap.nid);

            let entity = this.clientEntities.get(eSnap.nid);
            if (!entity) {
                entity = this.createClientEntity(eSnap);
                this.clientEntities.set(eSnap.nid, entity);
            }

            // Store target for interpolation
            const yPos = eSnap.type === 'enemy' ? (eSnap.scale || 0.8) / 2
                       : eSnap.type === 'pickup' ? 0.3
                       : eSnap.type === 'area_effect' ? 0.1
                       : 0.5;
            (entity as any).__targetX = eSnap.x;
            (entity as any).__targetZ = eSnap.z;
            (entity as any).__targetY = yPos;
            (entity as any).__entityType = eSnap.type;
            // Snap on first appearance
            if ((entity as any).__interpReady === undefined) {
                entity.setPosition(eSnap.x, yPos, eSnap.z);
                (entity as any).__interpReady = true;
            }

            // Update enemy health bar from snapshot
            if (eSnap.type === 'enemy' && eSnap.hp !== undefined) {
                const bar = (entity as any).__healthBarFg;
                const baseScale = (entity as any).__healthBarBaseScale;
                const maxHp = (entity as any).__maxHp || 20;
                if (bar && baseScale) {
                    const ratio = Math.max(0, eSnap.hp / maxHp);
                    bar.setLocalScale(baseScale * ratio, bar.getLocalScale().y, bar.getLocalScale().z);
                }
            }
        }

        for (const [nid, entity] of this.clientEntities) {
            if (!aliveNids.has(nid)) {
                entity.destroy();
                this.clientEntities.delete(nid);
            }
        }

        // Show floating damage numbers from host events
        if (snap.damageEvents) {
            for (const dmg of snap.damageEvents) {
                this.uiManager.showDamageAtWorldPos(dmg.x, dmg.z, dmg.damage, dmg.armor);
            }
        }
    }

    private createClientPlayerEntity(playerId: string, characterId: string): pc.Entity {
        const entity = createRemotePlayerVisual(this.app, characterId);
        entity.name = `client_player_${playerId}`;
        return entity;
    }

    private createClientEntity(snap: EntitySnapshot): pc.Entity {
        const entity = new pc.Entity(`net_${snap.type}_${snap.nid}`);

        if (snap.type === 'enemy') {
            // Same visual as EnemyFactory (identical to solo/host)
            entity.addComponent('render', { type: 'box' });
            const mat = new pc.StandardMaterial();
            const colorMap: Record<string, pc.Color> = {
                basic: new pc.Color(0.8, 0.2, 0.3),
                fast: new pc.Color(0.9, 0.9, 0.2),
                tank: new pc.Color(0.5, 0.2, 0.7),
                swarm: new pc.Color(0.3, 0.7, 0.9),
            };
            mat.diffuse = colorMap[snap.defId || 'basic'] || new pc.Color(0.8, 0.2, 0.3);
            mat.update();
            for (const mi of entity.render!.meshInstances) mi.material = mat;
            const s = snap.scale || 0.8;
            entity.setLocalScale(s, s, s);
            entity.setPosition(snap.x, s / 2, snap.z);

            // Health bar (same as EnemyFactory)
            const barWidth = 1.0;
            const barHeight = 0.06;
            const barY = (s * 0.5 + 0.2) / s;

            const barBg = new pc.Entity('hpbar_bg');
            barBg.addComponent('render', { type: 'box' });
            const bgMat = new pc.StandardMaterial();
            bgMat.diffuse = new pc.Color(0.08, 0.08, 0.08);
            bgMat.update();
            for (const mi of barBg.render!.meshInstances) mi.material = bgMat;
            barBg.setLocalScale((barWidth + 0.06) / s, barHeight / s, (barHeight + 0.02) / s);
            barBg.setLocalPosition(0, barY, 0);
            entity.addChild(barBg);

            const barFg = new pc.Entity('hpbar_fg');
            barFg.addComponent('render', { type: 'box' });
            const fgMat = new pc.StandardMaterial();
            fgMat.diffuse = new pc.Color(0.85, 0.12, 0.12);
            fgMat.emissive = new pc.Color(0.5, 0.05, 0.05);
            fgMat.emissiveIntensity = 1.5;
            fgMat.update();
            for (const mi of barFg.render!.meshInstances) mi.material = fgMat;
            barFg.setLocalScale(barWidth / s, barHeight / s, barHeight / s);
            barFg.setLocalPosition(0, barY, 0);
            entity.addChild(barFg);

            (entity as any).__healthBarFg = barFg;
            (entity as any).__healthBarBaseScale = barWidth / s;
            (entity as any).__maxHp = snap.maxHp || 20;
        } else if (snap.type === 'projectile') {
            entity.addComponent('render', { type: 'sphere' });
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(1, 1, 0.3);
            mat.emissive = new pc.Color(0.8, 0.8, 0.2);
            mat.emissiveIntensity = 2;
            mat.update();
            for (const mi of entity.render!.meshInstances) mi.material = mat;
            entity.setLocalScale(0.3, 0.3, 0.3);
            entity.setPosition(snap.x, 0.5, snap.z);
        } else if (snap.type === 'pickup') {
            entity.addComponent('render', { type: 'box' });
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(0.2, 1, 0.3);
            mat.emissive = new pc.Color(0.1, 0.8, 0.2);
            mat.emissiveIntensity = 2;
            mat.update();
            for (const mi of entity.render!.meshInstances) mi.material = mat;
            entity.setLocalScale(0.3, 0.3, 0.3);
            entity.setEulerAngles(45, 45, 0);
            entity.setPosition(snap.x, 0.3, snap.z);
        } else if (snap.type === 'area_effect') {
            entity.addComponent('render', { type: 'cylinder' });
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(1, 0.5, 0.2);
            mat.emissive = new pc.Color(1, 0.3, 0.1);
            mat.emissiveIntensity = 3;
            mat.opacity = 0.5;
            mat.blendType = pc.BLEND_ADDITIVE;
            mat.update();
            for (const mi of entity.render!.meshInstances) mi.material = mat;
            const s = snap.scale || 8;
            entity.setLocalScale(s, 0.2, s);
            entity.setPosition(snap.x, 0.1, snap.z);
        }

        this.app.root.addChild(entity);
        return entity;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: DEATH CHECK
    // ═══════════════════════════════════════════════════════════════════

    private checkRemotePlayerDeaths(): void {
        for (const [playerId, stats] of this.remotePlayerStats) {
            if (stats.hp <= 0 && this.remotePlayerAlive.get(playerId)) {
                // Mark as dead — don't delete, will respawn next wave
                this.remotePlayerAlive.set(playerId, false);
                const entity = this.remotePlayerEntities.get(playerId);
                if (entity) {
                    this.collisionSystem.unregister(entity);
                    entity.enabled = false;
                }
            }
        }

        // Game over when ALL players are dead
        if (this.areAllPlayersDead()) {
            this.network.sendGameOver();
            this.setState(GameState.GAME_OVER);
        }
    }

    /** Switch camera to the first alive player entity (spectator mode) */
    private switchCameraToAlivePlayer(): void {
        const camFollow = this.cameraEntity?.script?.get('cameraFollow') as CameraFollow | undefined;
        if (!camFollow) return;

        // Host side: find alive remote entity
        for (const [pid, alive] of this.remotePlayerAlive) {
            if (alive) {
                const entity = this.remotePlayerEntities.get(pid);
                if (entity) { camFollow.setTarget(entity); return; }
            }
        }

        // Client side: find alive client player entity
        for (const [, entity] of this.clientPlayerEntities) {
            if (entity.enabled) { camFollow.setTarget(entity); return; }
        }
    }

    /** Restore camera to own player after respawn */
    private restoreCameraToSelf(): void {
        if (!this.playerEntity) return;
        const camFollow = this.cameraEntity?.script?.get('cameraFollow') as CameraFollow | undefined;
        if (camFollow) camFollow.setTarget(this.playerEntity);
    }

    private areAllPlayersDead(): boolean {
        if (!this.hostDead && this.playerStats.hp > 0) return false;
        for (const [, alive] of this.remotePlayerAlive) {
            if (alive) return false;
        }
        return true;
    }

    private respawnDeadPlayers(): void {
        // Respawn host
        if (this.hostDead && this.playerEntity) {
            this.hostDead = false;
            this.playerStats.hp = this.playerStats.maxHp;
            this.playerStats.armor = 0;
            this.playerEntity.enabled = true;
            this.playerEntity.setPosition(0, 0.5, 0);
            this.collisionSystem.register(this.playerEntity, 0.4, CollisionLayer.PLAYER);
            this.syncStatsToEntity();
            this.restoreCameraToSelf();
        }

        // Respawn remote players
        for (const [playerId, alive] of this.remotePlayerAlive) {
            if (alive) continue;

            const stats = this.remotePlayerStats.get(playerId);
            if (stats) {
                stats.hp = stats.maxHp;
                stats.armor = 0;
            }

            this.remotePlayerAlive.set(playerId, true);

            let entity = this.remotePlayerEntities.get(playerId);
            if (entity) {
                entity.enabled = true;
                entity.setPosition(0, 0.5, 0);
                this.collisionSystem.register(entity, 0.4, CollisionLayer.PLAYER);
            } else {
                // Recreate entity if destroyed
                const charId = this.remotePlayerCharIds.get(playerId) || 'trump';
                entity = createRemotePlayerVisual(this.app, charId);
                entity.name = `remote_player_${playerId}`;
                entity.tags.add('player');
                entity.tags.add('remote_player');
                (entity as any).__playerId = playerId;
                (entity as any).__characterId = charId;
                this.remotePlayerEntities.set(playerId, entity);
                this.collisionSystem.register(entity, 0.4, CollisionLayer.PLAYER);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: COLLISION
    // ═══════════════════════════════════════════════════════════════════

    /** Host: handle a remote player's shop purchase */
    private handleRemoteBuy(playerId: string, itemId: string): void {
        if (this.state !== GameState.WAVE_END) return;
        if (this.remotePlayerShopBought.get(playerId)) return; // already bought this wave

        const gold = this.remotePlayerGold.get(playerId) ?? 0;
        const cost = this.shopSystem.getItemCost(itemId);
        if (gold < cost) return;

        const stats = this.remotePlayerStats.get(playerId);
        if (!stats) return;

        const item = this.shopSystem.getItems().find(i => i.id === itemId);
        if (!item) return;

        // Deduct gold and apply item
        this.remotePlayerGold.set(playerId, gold - cost);
        this.shopSystem.applyItemToStats(itemId, stats);
        this.remotePlayerShopBought.set(playerId, true);
    }

    /** Host: check if all players are ready to proceed */
    private checkAllReady(): void {
        if (this.state !== GameState.WAVE_END) return;

        // Need host + all remote players
        const totalPlayers = 1 + this.remotePlayerEntities.size;
        if (this.readyPlayers.size >= totalPlayers) {
            this.setState(GameState.PLAYING);
        }
    }

    private registerNewEntities(): void {
        for (const enemy of this.app.root.findByTag('enemy') as pc.Entity[]) {
            if ((enemy as any).__collisionId === undefined) {
                const def = (enemy as any).__enemyDef;
                this.collisionSystem.register(enemy, def ? def.scale * 0.5 : 0.4, CollisionLayer.ENEMY);
            }
        }
        for (const proj of this.app.root.findByTag('player_projectile') as pc.Entity[]) {
            if ((proj as any).__collisionId === undefined) {
                this.collisionSystem.register(proj, 0.15, CollisionLayer.PLAYER_PROJECTILE);
            }
        }
        for (const pickup of this.app.root.findByTag('xp_pickup') as pc.Entity[]) {
            if ((pickup as any).__collisionId === undefined) {
                this.collisionSystem.register(pickup, 0.3, CollisionLayer.PICKUP);
            }
        }
    }

    private handleCollision(a: pc.Entity, b: pc.Entity, layerA: CollisionLayer, layerB: CollisionLayer): void {
        if (this.isClient) return;

        // Projectile hits enemy
        if (layerA === CollisionLayer.PLAYER_PROJECTILE && layerB === CollisionLayer.ENEMY) {
            const projScript = a.script?.get('projectile') as any;
            const healthScript = b.script?.get('health') as any;
            if (projScript && healthScript) {
                // Tag the enemy with the last attacker for kill attribution
                const ownerId = (a as any).__ownerId;
                if (ownerId) (b as any).__lastAttacker = ownerId;
                healthScript.takeDamage(projScript.damage, false);
                this.collisionSystem.unregister(a);
                const nid = this.entityNetIds.get(a);
                if (nid !== undefined) { this.entityNetIds.delete(a); this.netIdEntities.delete(nid); }
                a.destroy();
            }
        }

        // Enemy touches player
        if (layerA === CollisionLayer.ENEMY && layerB === CollisionLayer.PLAYER) {
            const enemyAI = a.script?.get('enemyAI') as EnemyAI | undefined;
            if (!enemyAI || !enemyAI.canDealContactDamage()) return;

            let damage = enemyAI.contactDamage;

            if (b === this.playerEntity) {
                // Local player
                let armorHit = false;
                if (this.playerStats.armor > 0) {
                    armorHit = true;
                    if (this.playerStats.armor >= damage) {
                        this.playerStats.armor -= damage;
                        this.app.fire('damage:dealt', b, damage, true);
                        enemyAI.resetContactCooldown();
                        return;
                    }
                    damage -= this.playerStats.armor;
                    this.playerStats.armor = 0;
                }
                const playerHealth = b.script?.get('health') as Health | undefined;
                if (playerHealth) {
                    playerHealth.takeDamage(damage, armorHit);
                    this.playerStats.hp = playerHealth.hp;
                }
            } else {
                // Remote player
                const playerId = (b as any).__playerId as string | undefined;
                if (playerId) {
                    const stats = this.remotePlayerStats.get(playerId);
                    if (stats) {
                        let armorHit = false;
                        if (stats.armor > 0) {
                            armorHit = true;
                            if (stats.armor >= damage) {
                                stats.armor -= damage;
                                this.app.fire('damage:dealt', b, damage, true);
                                enemyAI.resetContactCooldown();
                                return;
                            }
                            damage -= stats.armor;
                            stats.armor = 0;
                        }
                        stats.hp = Math.max(0, stats.hp - damage);
                        this.app.fire('damage:dealt', b, damage, armorHit);
                    }
                }
            }
            enemyAI.resetContactCooldown();
        }

        // XP pickup — ALL XP goes to the shared global pool
        if (layerA === CollisionLayer.PICKUP && layerB === CollisionLayer.PLAYER) {
            const xpScript = a.script?.get('xpPickup') as XPPickup | undefined;
            if (xpScript) {
                this.app.fire('xp:collected', xpScript.xpValue);
                this.collisionSystem.unregister(a);
                const nid = this.entityNetIds.get(a);
                if (nid !== undefined) { this.entityNetIds.delete(a); this.netIdEntities.delete(nid); }
                a.destroy();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  RESET
    // ═══════════════════════════════════════════════════════════════════

    private resetGame(): void {
        this.gameTime = 0;
        this.killCount = 0;
        this.completedWave = 0;
        this.hostKills = 0;
        this.remotePlayerKills.clear();
        this.clientKills = 0;
        this.clientLevel = 1;
        this.clientXpProgress = 0;
        this.clientGold = 0;
        this.snapshotTimer = 0;
        nextNetId = 1;

        for (const e of this.app.root.findByTag('enemy')) e.destroy();
        for (const e of this.app.root.findByTag('projectile')) e.destroy();
        for (const e of this.app.root.findByTag('pickup')) e.destroy();
        for (const e of this.app.root.findByTag('area_effect')) e.destroy();
        for (const e of this.app.root.findByTag('remote_player')) e.destroy();

        for (const e of this.clientEntities.values()) e.destroy();
        this.clientEntities.clear();
        for (const e of this.clientPlayerEntities.values()) e.destroy();
        this.clientPlayerEntities.clear();

        this.remotePlayerEntities.clear();
        this.remotePlayerStats.clear();
        this.remotePlayerAlive.clear();
        this.remotePlayerCharIds.clear();
        this.remotePlayerWeaponIds.clear();
        this.remotePlayerGold.clear();
        this.remotePlayerShopBought.clear();
        this.remotePlayerUpgrades.clear();
        this.remotePlayerPendingLevelUps.clear();
        this.hostPendingLevelUps = 0;
        this.clientPendingLevelUps = 0;
        this.pendingRemoteInputs.clear();
        this.readyPlayers.clear();
        this.hostDead = false;
        this.entityNetIds.clear();
        this.netIdEntities.clear();

        if (this.playerEntity) { this.playerEntity.destroy(); this.playerEntity = null; }

        this.collisionSystem.clear();
        this.combatSystem.clear();
        this.waveSystem.reset();
        this.xpSystem.reset();
        this.upgradeSystem.reset();
        this.shopSystem.reset();
    }

    private defaultStats(): PlayerStats {
        return {
            maxHp: PLAYER_BASE_HP, hp: PLAYER_BASE_HP, speed: PLAYER_BASE_SPEED,
            damage: 1, cooldownMultiplier: 1, magnetRadius: PLAYER_MAGNET_RADIUS,
            armor: 0, maxArmor: 0, projectileCount: 0,
        };
    }

    // Getters for UI
    getHP(): number { return this.playerStats.hp; }
    getMaxHP(): number { return this.playerStats.maxHp; }
    getLevel(): number { return this.isClient ? this.clientLevel : this.xpSystem.currentLevel; }
    getXPProgress(): number { return this.isClient ? this.clientXpProgress : this.xpSystem.getProgress(); }
    getWave(): number { return this.waveSystem.currentWave; }
    getGameTime(): number { return this.gameTime; }
    getKillCount(): number { return this.isClient ? this.clientKills : this.hostKills; }
    getTeamKillCount(): number { return this.killCount; }
    getArmor(): number { return this.playerStats.armor; }
    getMaxArmor(): number { return this.playerStats.maxArmor; }
    getGold(): number { return this.isClient ? this.clientGold : this.shopSystem.gold; }
    isSpectating(): boolean { return this.isMultiplayerGame && this.hostDead; }
    getReadyCount(): number { return this.readyPlayers.size; }
    getTotalPlayerCount(): number { return this.isMultiplayerGame ? 1 + this.remotePlayerEntities.size + this.clientPlayerEntities.size : 1; }
    isPlayerReady(playerId: string): boolean { return this.readyPlayers.has(playerId); }
    isSelfReady(): boolean { return this.readyPlayers.has(this.network.myId || ''); }

    // Getters for nametags (UI needs access to player entities)
    getPlayerEntity(): pc.Entity | null { return this.playerEntity; }
    getRemotePlayerEntities(): Map<string, pc.Entity> { return this.remotePlayerEntities; }
    getClientPlayerEntities(): Map<string, pc.Entity> { return this.clientPlayerEntities; }
}
