import * as pc from 'playcanvas';
import { GameState, CollisionLayer, PLAYER_BASE_HP, PLAYER_BASE_SPEED, PLAYER_MAGNET_RADIUS } from '../constants';
import { PlayerStats, CharacterDef } from '../types';
import { InputManager } from './InputManager';
import { NetworkManager, FullSnapshot, EntitySnapshot, PlayerNetState } from './NetworkManager';
import { setupScene } from './SceneSetup';
import { createPlayer } from '../entities/PlayerFactory';
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

const SNAPSHOT_INTERVAL = 1 / 20; // 20 Hz

// Global unique ID counter for network entities (host only)
let nextNetId = 1;
function allocNetId(): number { return nextNetId++; }

export class Game {
    app: pc.Application;
    state: GameState = GameState.LOADING;
    inputManager: InputManager;
    network: NetworkManager;

    // Scene entities
    private cameraEntity: pc.Entity | null = null;
    private lightEntity: pc.Entity | null = null;
    private playerEntity: pc.Entity | null = null;

    // Multiplayer
    isMultiplayerGame: boolean = false;
    private snapshotTimer: number = 0;

    // Host: remote player entities (real entities with collision)
    private remotePlayerEntities: Map<number, pc.Entity> = new Map();
    private remotePlayerStats: Map<number, PlayerStats> = new Map();
    // Host: maps entity → networkId
    private entityNetIds: Map<pc.Entity, number> = new Map();
    private netIdEntities: Map<number, pc.Entity> = new Map();

    // Client: all rendered entities from snapshots
    private clientEntities: Map<number, pc.Entity> = new Map(); // nid → entity
    private clientPlayerEntities: Map<number, pc.Entity> = new Map(); // userId → entity

    // Systems
    collisionSystem: CollisionSystem;
    combatSystem: CombatSystem;
    waveSystem: WaveSystem;
    xpSystem: XPSystem;
    upgradeSystem: UpgradeSystem;
    shopSystem: ShopSystem;

    // UI
    uiManager: UIManager;

    // Player state
    playerStats: PlayerStats = this.defaultStats();
    selectedCharacter: CharacterDef | null = null;
    selectedWeaponId: string | null = null;
    gameTime: number = 0;
    killCount: number = 0;

    /** True if this client is the host (runs simulation) */
    get isHost(): boolean { return !this.isMultiplayerGame || this.network.isHost; }
    /** True if this client is a non-host (render only) */
    get isClient(): boolean { return this.isMultiplayerGame && !this.network.isHost; }

    constructor(app: pc.Application) {
        this.app = app;
        (app as any).__game = this;

        this.inputManager = new InputManager(app);
        this.network = new NetworkManager();

        // Init systems
        this.collisionSystem = new CollisionSystem(this.handleCollision.bind(this));
        this.combatSystem = new CombatSystem(app);
        this.waveSystem = new WaveSystem(app);
        this.xpSystem = new XPSystem(app);
        this.upgradeSystem = new UpgradeSystem();
        this.shopSystem = new ShopSystem();

        // Init UI
        this.uiManager = new UIManager(this);

        // Register game loop
        app.on('update', this.update, this);

        this.setupEvents();
        this.setupNetworkCallbacks();
    }

    init(): void {
        const { camera, light } = setupScene(this.app);
        this.cameraEntity = camera;
        this.lightEntity = light;

        this.cameraEntity.addComponent('script');
        this.cameraEntity.script!.create(CameraFollow);

        this.lightEntity.addComponent('script');
        this.lightEntity.script!.create(DayNightCycle);

        this.setState(GameState.MAIN_MENU);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════

    private setupEvents(): void {
        this.app.on('enemy:died', (entity: pc.Entity, _xpReward: number) => {
            if (this.isClient) return; // clients don't process deaths

            this.killCount++;
            this.shopSystem.addGold(Math.floor(Math.random() * 5) + 1);
            this.collisionSystem.unregister(entity);

            // Remove from network tracking
            const nid = this.entityNetIds.get(entity);
            if (nid !== undefined) {
                this.entityNetIds.delete(entity);
                this.netIdEntities.delete(nid);
            }

            setTimeout(() => { if (entity.parent) entity.destroy(); }, 50);
        });

        this.app.on('xp:collected', (_amount: number) => {
            // XPSystem handles it
        });

        this.app.on('player:levelup', (_level: number) => {
            if (this.state === GameState.PLAYING) {
                this.setState(GameState.LEVEL_UP);
            }
        });

        this.app.on('wave:complete', (_waveIndex: number) => {
            if (this.state === GameState.PLAYING) {
                this.setState(GameState.WAVE_END);
            }
        });

        this.app.on('player:died', () => {
            this.setState(GameState.GAME_OVER);
        });
    }

    private setupNetworkCallbacks(): void {
        // Host receives remote player input
        this.network.onRemoteInput = (data) => {
            if (!this.isHost) return;
            const entity = this.remotePlayerEntities.get(data.userId);
            if (!entity) return;

            const stats = this.remotePlayerStats.get(data.userId);
            const speed = stats?.speed || PLAYER_BASE_SPEED;

            // Move remote player
            const pos = entity.getPosition();
            const len = Math.sqrt(data.moveX * data.moveX + data.moveZ * data.moveZ);
            if (len > 0) {
                const nx = data.moveX / len;
                const nz = data.moveZ / len;
                entity.setPosition(
                    Math.max(-39, Math.min(39, pos.x + nx * speed * (1 / 60))),
                    pos.y,
                    Math.max(-39, Math.min(39, pos.z + nz * speed * (1 / 60)))
                );
            }

            // Face aim direction
            if (data.aimX !== 0 || data.aimZ !== 0) {
                const angle = Math.atan2(data.aimX, data.aimZ) * (180 / Math.PI);
                entity.setEulerAngles(0, angle, 0);
            }

            // Fire weapons for remote player
            if (data.fire) {
                this.combatSystem.fireForRemotePlayer(
                    entity,
                    data.aimX, data.aimZ,
                    stats?.damage || 1,
                    stats?.projectileCount || 0
                );
            }
        };

        // Client receives full snapshot from host
        this.network.onSnapshot = (snap: FullSnapshot) => {
            if (!this.isClient) return;
            this.applySnapshot(snap);
        };

        this.network.onGameOver = () => {
            this.setState(GameState.GAME_OVER);
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
        this.setState(GameState.WEAPON_SELECT);
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

        this.playerEntity = createPlayer(this.app, charDef);

        if (this.isHost) {
            this.collisionSystem.register(this.playerEntity, 0.4, CollisionLayer.PLAYER);
        }

        const camFollow = this.cameraEntity?.script?.get('cameraFollow') as CameraFollow | undefined;
        if (camFollow) camFollow.setTarget(this.playerEntity);

        if (this.isHost) {
            this.combatSystem.setPlayer(this.playerEntity);
            const weaponDef = WEAPONS.find(w => w.id === weaponId);
            if (weaponDef) this.combatSystem.addWeapon(weaponDef);

            // Spawn remote player entities on host
            if (this.isMultiplayerGame) this.spawnRemotePlayersOnHost();
        }

        this.setState(GameState.PLAYING);
    }

    private spawnRemotePlayersOnHost(): void {
        const colors = [
            new pc.Color(0.2, 0.8, 0.4),
            new pc.Color(0.8, 0.4, 0.8),
            new pc.Color(0.2, 0.7, 0.9),
        ];
        let ci = 0;

        for (const p of this.network.roomPlayers) {
            if (p.userId === this.network.userId) continue;

            const charDef = CHARACTERS.find(c => c.id === p.characterId) || CHARACTERS[0];

            // Create entity with collision (visible on host)
            const entity = new pc.Entity(`remote_player_${p.userId}`);
            entity.addComponent('render', { type: 'capsule' });
            const mat = new pc.StandardMaterial();
            mat.diffuse = colors[ci++ % colors.length];
            mat.update();
            for (const mi of entity.render!.meshInstances) mi.material = mat;

            entity.setPosition(2, 0.5, 0);
            entity.setLocalScale(0.8, 0.8, 0.8);
            entity.tags.add('player');
            entity.tags.add('remote_player');

            this.app.root.addChild(entity);
            this.remotePlayerEntities.set(p.userId, entity);
            this.collisionSystem.register(entity, 0.4, CollisionLayer.PLAYER);

            // Track stats for remote player
            const stats: PlayerStats = {
                maxHp: charDef.hp, hp: charDef.hp, speed: charDef.speed,
                damage: 1, cooldownMultiplier: 1, magnetRadius: PLAYER_MAGNET_RADIUS,
                armor: 0, maxArmor: 0, projectileCount: 0,
            };
            this.remotePlayerStats.set(p.userId, stats);

            // Give remote player a weapon
            const weaponDef = WEAPONS.find(w => w.id === p.weaponId) || WEAPONS[0];
            this.combatSystem.addRemoteWeapon(p.userId, weaponDef);
        }
    }

    selectUpgrade(upgradeId: string): void {
        this.upgradeSystem.applyUpgrade(upgradeId, this.playerStats);

        if (this.playerEntity?.script) {
            const controller = this.playerEntity.script.get('playerController') as any;
            if (controller) controller.speed = this.playerStats.speed;

            const health = this.playerEntity.script.get('health') as any;
            if (health) {
                health.maxHp = this.playerStats.maxHp;
                health.hp = this.playerStats.hp;
            }
        }
        this.setState(GameState.PLAYING);
    }

    buyItem(itemId: string): boolean {
        const success = this.shopSystem.buy(itemId, this.playerStats);
        if (success && this.playerEntity?.script) {
            const controller = this.playerEntity.script.get('playerController') as any;
            if (controller) controller.speed = this.playerStats.speed;
            const health = this.playerEntity.script.get('health') as any;
            if (health) {
                health.maxHp = this.playerStats.maxHp;
                health.hp = this.playerStats.hp;
            }
        }
        return success;
    }

    continueToNextWave(): void {
        if (this.state === GameState.WAVE_END) this.setState(GameState.PLAYING);
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

            if (this.inputManager.getState().pause) {
                this.pauseGame();
                return;
            }

            if (this.isHost) {
                // ── HOST: run full simulation ──
                this.registerNewEntities();
                this.collisionSystem.update();
                this.combatSystem.update(
                    dt,
                    this.playerStats.cooldownMultiplier,
                    this.playerStats.damage,
                    this.playerStats.projectileCount
                );
                this.waveSystem.update(dt);
                this.uiManager.updateHUD();

                // Send snapshot to clients
                if (this.isMultiplayerGame) {
                    this.snapshotTimer += dt;
                    if (this.snapshotTimer >= SNAPSHOT_INTERVAL) {
                        this.snapshotTimer = 0;
                        this.broadcastSnapshot();
                    }
                }
            } else {
                // ── CLIENT: only send input, rendering is done by applySnapshot ──
                const input = this.inputManager.getState();
                this.network.sendInput({
                    moveX: input.moveDirection.x,
                    moveZ: input.moveDirection.y,
                    aimX: input.aimDirection.x,
                    aimZ: input.aimDirection.y,
                    fire: input.fire,
                });
                this.uiManager.updateHUD();
            }

        } else if (this.state === GameState.PAUSED || this.state === GameState.LEVEL_UP || this.state === GameState.WAVE_END) {
            this.inputManager.update(this.playerEntity, this.cameraEntity);
            if (this.state === GameState.PAUSED && this.inputManager.getState().pause) {
                this.resumeGame();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: SNAPSHOT BROADCAST
    // ═══════════════════════════════════════════════════════════════════

    private broadcastSnapshot(): void {
        if (!this.playerEntity) return;

        // Players
        const pos = this.playerEntity.getPosition();
        const ang = this.playerEntity.getEulerAngles();
        const players: PlayerNetState[] = [{
            userId: this.network.userId!,
            x: pos.x, z: pos.z, angle: ang.y,
            hp: this.playerStats.hp, maxHp: this.playerStats.maxHp,
            armor: this.playerStats.armor, maxArmor: this.playerStats.maxArmor,
            speed: this.playerStats.speed,
        }];

        for (const [userId, entity] of this.remotePlayerEntities) {
            const rp = entity.getPosition();
            const ra = entity.getEulerAngles();
            const stats = this.remotePlayerStats.get(userId);
            players.push({
                userId,
                x: rp.x, z: rp.z, angle: ra.y,
                hp: stats?.hp ?? 100, maxHp: stats?.maxHp ?? 100,
                armor: stats?.armor ?? 0, maxArmor: stats?.maxArmor ?? 0,
                speed: stats?.speed ?? 8,
            });
        }

        // All entities: enemies, projectiles, pickups
        const entities: EntitySnapshot[] = [];

        // Enemies
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const e of enemies) {
            let nid = this.entityNetIds.get(e);
            if (nid === undefined) {
                nid = allocNetId();
                this.entityNetIds.set(e, nid);
                this.netIdEntities.set(nid, e);
            }
            const ep = e.getPosition();
            const def = (e as any).__enemyDef;
            const health = e.script?.get('health') as any;
            entities.push({
                nid, type: 'enemy', defId: def?.id || 'basic',
                x: ep.x, z: ep.z, hp: health?.hp ?? 0,
                scale: def?.scale ?? 0.8,
            });
        }

        // Projectiles
        const projectiles = this.app.root.findByTag('player_projectile') as pc.Entity[];
        for (const p of projectiles) {
            let nid = this.entityNetIds.get(p);
            if (nid === undefined) {
                nid = allocNetId();
                this.entityNetIds.set(p, nid);
                this.netIdEntities.set(nid, p);
            }
            const pp = p.getPosition();
            entities.push({
                nid, type: 'projectile',
                x: pp.x, z: pp.z,
            });
        }

        // Pickups
        const pickups = this.app.root.findByTag('xp_pickup') as pc.Entity[];
        for (const pk of pickups) {
            let nid = this.entityNetIds.get(pk);
            if (nid === undefined) {
                nid = allocNetId();
                this.entityNetIds.set(pk, nid);
                this.netIdEntities.set(nid, pk);
            }
            const pkp = pk.getPosition();
            entities.push({
                nid, type: 'pickup',
                x: pkp.x, z: pkp.z,
            });
        }

        this.network.sendSnapshot({
            tick: Math.floor(this.gameTime * 20),
            gameTime: this.gameTime,
            wave: this.waveSystem.currentWave,
            nightFactor: (this.app as any).__nightFactor ?? 0,
            players,
            entities,
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CLIENT: APPLY SNAPSHOT
    // ═══════════════════════════════════════════════════════════════════

    private applySnapshot(snap: FullSnapshot): void {
        this.gameTime = snap.gameTime;

        // Update local player from host's authoritative state
        const myState = snap.players.find(p => p.userId === this.network.userId);
        if (myState && this.playerEntity) {
            // Reconcile position (smooth lerp)
            const pos = this.playerEntity.getPosition();
            this.playerEntity.setPosition(
                pos.x + (myState.x - pos.x) * 0.3,
                0.5,
                pos.z + (myState.z - pos.z) * 0.3
            );
            this.playerStats.hp = myState.hp;
            this.playerStats.maxHp = myState.maxHp;
            this.playerStats.armor = myState.armor;
            this.playerStats.maxArmor = myState.maxArmor;
        }

        // Update other players
        for (const pState of snap.players) {
            if (pState.userId === this.network.userId) continue;

            let entity = this.clientPlayerEntities.get(pState.userId);
            if (!entity) {
                entity = this.createClientPlayerEntity(pState.userId);
                this.clientPlayerEntities.set(pState.userId, entity);
            }

            const cp = entity.getPosition();
            entity.setPosition(
                cp.x + (pState.x - cp.x) * 0.3,
                0.5,
                cp.z + (pState.z - cp.z) * 0.3
            );
            entity.setEulerAngles(0, pState.angle, 0);
        }

        // Track which network entities are still alive
        const aliveNids = new Set<number>();

        for (const eSnap of snap.entities) {
            aliveNids.add(eSnap.nid);

            let entity = this.clientEntities.get(eSnap.nid);
            if (!entity) {
                entity = this.createClientEntity(eSnap);
                this.clientEntities.set(eSnap.nid, entity);
            }

            // Update position (smooth lerp)
            const ep = entity.getPosition();
            entity.setPosition(
                ep.x + (eSnap.x - ep.x) * 0.4,
                entity.getPosition().y,
                ep.z + (eSnap.z - ep.z) * 0.4
            );
        }

        // Destroy entities no longer in snapshot
        for (const [nid, entity] of this.clientEntities) {
            if (!aliveNids.has(nid)) {
                entity.destroy();
                this.clientEntities.delete(nid);
            }
        }
    }

    private createClientPlayerEntity(userId: number): pc.Entity {
        const entity = new pc.Entity(`client_player_${userId}`);
        entity.addComponent('render', { type: 'capsule' });
        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(0.2, 0.8, 0.4);
        mat.update();
        for (const mi of entity.render!.meshInstances) mi.material = mat;
        entity.setLocalScale(0.8, 0.8, 0.8);
        entity.setPosition(0, 0.5, 0);
        this.app.root.addChild(entity);
        return entity;
    }

    private createClientEntity(snap: EntitySnapshot): pc.Entity {
        const entity = new pc.Entity(`net_${snap.type}_${snap.nid}`);

        if (snap.type === 'enemy') {
            entity.addComponent('render', { type: 'box' });
            const mat = new pc.StandardMaterial();
            // Color by enemy type
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
        }

        this.app.root.addChild(entity);
        return entity;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HOST: COLLISION & REGISTRATION
    // ═══════════════════════════════════════════════════════════════════

    private registerNewEntities(): void {
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const enemy of enemies) {
            if ((enemy as any).__collisionId === undefined) {
                const def = (enemy as any).__enemyDef;
                const radius = def ? def.scale * 0.5 : 0.4;
                this.collisionSystem.register(enemy, radius, CollisionLayer.ENEMY);
            }
        }

        const projectiles = this.app.root.findByTag('player_projectile') as pc.Entity[];
        for (const proj of projectiles) {
            if ((proj as any).__collisionId === undefined) {
                this.collisionSystem.register(proj, 0.15, CollisionLayer.PLAYER_PROJECTILE);
            }
        }

        const pickups = this.app.root.findByTag('xp_pickup') as pc.Entity[];
        for (const pickup of pickups) {
            if ((pickup as any).__collisionId === undefined) {
                this.collisionSystem.register(pickup, 0.3, CollisionLayer.PICKUP);
            }
        }
    }

    private handleCollision(a: pc.Entity, b: pc.Entity, layerA: CollisionLayer, layerB: CollisionLayer): void {
        if (this.isClient) return; // clients don't process collisions

        // Projectile hits enemy
        if (layerA === CollisionLayer.PLAYER_PROJECTILE && layerB === CollisionLayer.ENEMY) {
            const projScript = a.script?.get('projectile') as any;
            const healthScript = b.script?.get('health') as any;
            if (projScript && healthScript) {
                healthScript.takeDamage(projScript.damage, false);
                this.collisionSystem.unregister(a);
                const nid = this.entityNetIds.get(a);
                if (nid !== undefined) { this.entityNetIds.delete(a); this.netIdEntities.delete(nid); }
                a.destroy();
            }
        }

        // Enemy touches player (any player entity)
        if (layerA === CollisionLayer.ENEMY && layerB === CollisionLayer.PLAYER) {
            const enemyAI = a.script?.get('enemyAI') as EnemyAI | undefined;
            if (!enemyAI || !enemyAI.canDealContactDamage()) return;

            let damage = enemyAI.contactDamage;

            // Is it the local player?
            if (b === this.playerEntity) {
                let armorHit = false;
                if (this.playerStats.armor > 0) {
                    armorHit = true;
                    if (this.playerStats.armor >= damage) {
                        this.playerStats.armor -= damage;
                        this.app.fire('damage:dealt', b, damage, true);
                        enemyAI.resetContactCooldown();
                        return;
                    } else {
                        damage -= this.playerStats.armor;
                        this.playerStats.armor = 0;
                    }
                }
                const playerHealth = b.script?.get('health') as Health | undefined;
                if (playerHealth) {
                    playerHealth.takeDamage(damage, armorHit);
                    this.playerStats.hp = playerHealth.hp;
                }
            } else {
                // Remote player on host — find their stats
                for (const [userId, entity] of this.remotePlayerEntities) {
                    if (entity === b) {
                        const stats = this.remotePlayerStats.get(userId);
                        if (stats) {
                            if (stats.armor > 0) {
                                if (stats.armor >= damage) { stats.armor -= damage; break; }
                                damage -= stats.armor;
                                stats.armor = 0;
                            }
                            stats.hp = Math.max(0, stats.hp - damage);
                        }
                        break;
                    }
                }
            }
            enemyAI.resetContactCooldown();
        }

        // Player picks up XP
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
        this.snapshotTimer = 0;
        nextNetId = 1;

        for (const e of this.app.root.findByTag('enemy')) e.destroy();
        for (const e of this.app.root.findByTag('projectile')) e.destroy();
        for (const e of this.app.root.findByTag('pickup')) e.destroy();
        for (const e of this.app.root.findByTag('area_effect')) e.destroy();
        for (const e of this.app.root.findByTag('remote_player')) e.destroy();

        // Client entities
        for (const e of this.clientEntities.values()) e.destroy();
        this.clientEntities.clear();
        for (const e of this.clientPlayerEntities.values()) e.destroy();
        this.clientPlayerEntities.clear();

        this.remotePlayerEntities.clear();
        this.remotePlayerStats.clear();
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
    getLevel(): number { return this.xpSystem.currentLevel; }
    getXPProgress(): number { return this.xpSystem.getProgress(); }
    getWave(): number { return this.waveSystem.currentWave; }
    getGameTime(): number { return this.gameTime; }
    getKillCount(): number { return this.killCount; }
    getArmor(): number { return this.playerStats.armor; }
    getMaxArmor(): number { return this.playerStats.maxArmor; }
    getGold(): number { return this.shopSystem.gold; }
}
