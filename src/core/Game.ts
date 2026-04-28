import * as pc from "playcanvas";
import {
  GameState,
  CollisionLayer,
  PLAYER_BASE_HP,
  PLAYER_BASE_SPEED,
  PLAYER_MAGNET_RADIUS,
} from "../constants";
import { PlayerStats, CharacterDef } from "../types";
import { InputManager } from "./InputManager";
import {
  NetworkManager,
  PlayerSnapshot,
  PlayerNetState,
  EnemySpawnEvent,
  EnemyDieEvent,
  ProjectileFireEvent,
  PickupSpawnEvent,
  PickupCollectedEvent,
  AreaEffectEvent,
  WallEffectEvent,
  StateSyncEvent,
  DamageEventNet,
} from "./NetworkManager";
import { setupScene, getMapModelPaths } from "./SceneSetup";
import { preloadModels, getCachedModel } from "./AssetLoader";
import { createPlayer } from "../entities/PlayerFactory";
import { createRemotePlayerVisual } from "../entities/RemotePlayerFactory";
import { createEnemy } from "../entities/EnemyFactory";
import { createProjectile } from "../entities/ProjectileFactory";
import { createXPPickup } from "../entities/PickupFactory";
import { CollisionSystem } from "../systems/CollisionSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { WaveSystem } from "../systems/WaveSystem";
import { XPSystem } from "../systems/XPSystem";
import { UpgradeSystem } from "../systems/UpgradeSystem";
import { ShopSystem } from "../systems/ShopSystem";
import { HighScoreManager, HighScoreEntry } from "./HighScoreManager";
import { CHARACTERS } from "../data/characters";
import { WEAPONS } from "../data/weapons";
import { ENEMIES } from "../data/enemies";
import { CameraFollow } from "../scripts/CameraFollow";
import { DayNightCycle } from "../scripts/DayNightCycle";
import { EnemyAI } from "../scripts/EnemyAI";
import { Health } from "../scripts/Health";
import { XPPickup } from "../scripts/XPPickup";
import { UIManager } from "../ui/UIManager";
import { AudioManager } from "./AudioManager";

const PLAYER_SNAPSHOT_INTERVAL = 1 / 10; // 10 Hz — reconciliation only (clients predict locally)
const STATE_SYNC_INTERVAL = 1 / 5;      // 5 Hz — lightweight metadata sync

let nextNetId = 1;
function allocNetId(): number {
  return nextNetId++;
}

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
  private playerSnapshotTimer: number = 0;
  private stateSyncTimer: number = 0;
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
  private pendingRemoteInputs: Map<
    string,
    { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }
  > = new Map();

  // Wave ready system (multiplayer)
  readyPlayers: Set<string> = new Set();



  // Client-side pending level-ups (from snapshot)
  private clientPendingLevelUps: number = 0;

  // Host: entity ↔ networkId mapping
  private entityNetIds: Map<pc.Entity, number> = new Map();
  private netIdEntities: Map<number, pc.Entity> = new Map();

  // Client: rendered entities from events
  private clientEntities: Map<number, pc.Entity> = new Map();
  private clientPlayerEntities: Map<string, pc.Entity> = new Map();

  // Client: input dedup to avoid flooding network
  private lastInputSent: { mx: number; mz: number; ax: number; az: number } | null = null;

  // Systems
  collisionSystem: CollisionSystem;
  combatSystem: CombatSystem;
  waveSystem: WaveSystem;
  xpSystem: XPSystem;
  upgradeSystem: UpgradeSystem;
  shopSystem: ShopSystem;

  // UI
  uiManager!: UIManager;

  // Audio
  audioManager: AudioManager;

  // Player state
  playerStats: PlayerStats = this.defaultStats();
  selectedCharacter: CharacterDef | null = null;
  selectedWeaponId: string | null = null;
  gameTime: number = 0;
  killCount: number = 0;
  completedWave: number = 0;
  lastHighScore: HighScoreEntry | null = null;
  private hostKills: number = 0;
  private remotePlayerKills: Map<string, number> = new Map();
  private clientKills: number = 0;
  private clientLevel: number = 1;
  private clientXpProgress: number = 0;
  private clientGold: number = 0;

  get isHost(): boolean {
    return !this.isMultiplayerGame || this.network.isHost;
  }
  get isClient(): boolean {
    return this.isMultiplayerGame && !this.network.isHost;
  }

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

    // Init Audio (before UI — PauseScreen needs audioManager)
    this.audioManager = new AudioManager();

    app.on("update", this.update, this);

    this.setupEvents();
    this.setupNetworkCallbacks();
  }

  /** Must be called after constructor (UIManager needs Game reference) */
  initUI(): void {
    this.uiManager = new UIManager(this);
  }

  async init(): Promise<void> {
    // Preload map models
    try {
      await preloadModels(this.app, getMapModelPaths());
    } catch (e) {
      console.warn("Map models non charges, fallback:", e);
    }

    const { camera, light } = setupScene(this.app);
    this.cameraEntity = camera;
    this.lightEntity = light;

    this.cameraEntity.addComponent("script");
    this.cameraEntity.script!.create(CameraFollow);

    this.lightEntity.addComponent("script");
    this.lightEntity.script!.create(DayNightCycle);

    this.initUI();
    this.setState(GameState.MAIN_MENU);

    // Start menu music
    this.audioManager.playMusic("menu");
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════════════════════════════════

  private setupEvents(): void {
    this.app.on("enemy:died", (entity: pc.Entity, _xpReward: number) => {
      if (this.isClient) return;
      if ((entity as any).__deathProcessed) return;
      (entity as any).__deathProcessed = true;

      this.killCount++;
      this.audioManager.playSfx("enemyDeath");

      // Attribute kill to the player who dealt the last hit
      const killerId = (entity as any).__lastAttacker as string | undefined;
      if (killerId) {
        if (killerId === this.network.myId) {
          this.hostKills++;
        } else {
          this.remotePlayerKills.set(
            killerId,
            (this.remotePlayerKills.get(killerId) || 0) + 1,
          );
        }
      } else if (!this.isMultiplayerGame) {
        this.hostKills++;
      }

      const goldReward = Math.floor(Math.random() * 5) + 1;
      this.shopSystem.addGold(goldReward);
      // Give gold to all remote players too
      for (const [pid] of this.remotePlayerGold) {
        this.remotePlayerGold.set(
          pid,
          (this.remotePlayerGold.get(pid) || 0) + goldReward,
        );
      }
      this.collisionSystem.unregister(entity);

      const nid = this.entityNetIds.get(entity);
      if (nid !== undefined) {
        // Notify clients that this enemy died
        if (this.isMultiplayerGame) {
          this.network.sendEnemyDie({ nid });
        }
        this.entityNetIds.delete(entity);
        this.netIdEntities.delete(nid);
      }

      // Disable AI and collision so it doesn't block or move
      const ai = entity.script?.get("enemyAI");
      if (ai instanceof EnemyAI) ai.enabled = false;

      // Death animation already triggered in Health.die() with a guard.
      // Just delay the entity destruction so the animation can finish playing.
      const hasAnims = (entity as any).__hasAnims;

      setTimeout(
        () => {
          if (entity.parent) entity.destroy();
        },
        hasAnims ? 2000 : 50,
      );
    });

    // Send damage events immediately to clients (event-driven)
    this.app.on(
      "damage:dealt",
      (entity: any, damage: number, armorAbsorbed: boolean) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        if (!entity?.getPosition) return;
        const pos = entity.getPosition();
        this.network.sendDamageEvent({
          x: pos.x,
          z: pos.z,
          damage,
          armor: armorAbsorbed ?? false,
        });
      },
    );

    this.app.on("xp:collected", (_amount: number) => {
      this.audioManager.playSfx("xpPickup");
    });

    this.app.on("player:levelup", (_level: number) => {
      if (this.state === GameState.PLAYING) {
        this.audioManager.pauseMusic();
        this.audioManager.playSfx("levelup");
        if (this.isMultiplayerGame && this.isHost) {
          this.readyPlayers.clear();
        }
        this.setState(GameState.LEVEL_UP);
      }
    });

    this.app.on("wave:complete", (waveIndex: number) => {
      if (this.state === GameState.PLAYING) {
        this.audioManager.playSfx("waveStart");
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

    // Player died — fade to black, then show defeat screen
    this.app.on("player:died", () => {
      if (this.isMultiplayerGame) {
        if (this.isHost) {
          this.hostDead = true;
          this.audioManager.playSfx("playerDeath");
          if (this.playerEntity) {
            this.playerEntity.enabled = false;
            this.collisionSystem.unregister(this.playerEntity);
          }
          this.switchCameraToAlivePlayer();
          if (this.areAllPlayersDead()) {
            this.triggerGameOverSequence(true);
          }
        }
        return;
      }
      // Solo death
      this.triggerGameOverSequence(false);
    });

    // Player hit SFX
    this.app.on(
      "damage:dealt",
      (entity: pc.Entity, _damage: number, _armorHit: boolean) => {
        if (entity && entity.tags && entity.tags.has("player")) {
          this.audioManager.playSfx("playerHit");
        }
      },
    );

    // Host: relay enemy spawn events to clients
    this.app.on(
      "enemy:spawned",
      (entity: pc.Entity, modifiedDef: any, x: number, z: number) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        // Allocate network ID for this enemy
        let nid = this.entityNetIds.get(entity);
        if (nid === undefined) {
          nid = allocNetId();
          this.entityNetIds.set(entity, nid);
          this.netIdEntities.set(nid, entity);
        }
        this.network.sendEnemySpawn({
          nid,
          defId: modifiedDef.id,
          x,
          z,
          hp: modifiedDef.hp,
          damage: modifiedDef.damage,
          speed: modifiedDef.speed,
          scale: modifiedDef.scale,
        });
      },
    );

    // Host: relay pickup spawn events to clients
    this.app.on(
      "pickup:spawned",
      (entity: pc.Entity, xpValue: number, x: number, z: number) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        let nid = this.entityNetIds.get(entity);
        if (nid === undefined) {
          nid = allocNetId();
          this.entityNetIds.set(entity, nid);
          this.netIdEntities.set(nid, entity);
        }
        this.network.sendPickupSpawn({ nid, x, z, xpValue });
      },
    );

    // Host: relay projectile fire events to clients
    this.app.on(
      "projectile:fired",
      (entity: pc.Entity, info: { ownerId: string | null; dirX: number; dirZ: number; speed: number; lifetime: number; damage: number; isEnemy: boolean; modelPath?: string; modelScale?: number; text?: string }) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        let nid = this.entityNetIds.get(entity);
        if (nid === undefined) {
          nid = allocNetId();
          this.entityNetIds.set(entity, nid);
          this.netIdEntities.set(nid, entity);
        }
        const pos = entity.getPosition();
        this.network.sendProjectileFire({
          nid,
          playerId: info.ownerId || "",
          x: pos.x,
          z: pos.z,
          dirX: info.dirX,
          dirZ: info.dirZ,
          speed: info.speed,
          lifetime: info.lifetime,
          damage: info.damage,
          isEnemy: info.isEnemy,
          modelPath: info.modelPath,
          modelScale: info.modelScale,
          text: info.text,
        });
      },
    );

    // Host: relay area effect events to clients
    this.app.on(
      "areaEffect:fired",
      (x: number, z: number, radius: number) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        this.network.sendAreaEffect({ x, z, radius });
      },
    );

    // Host: relay wall effect events to clients
    this.app.on(
      "wallEffect:fired",
      (x: number, z: number, dirX: number, dirZ: number, halfWidth: number, damage: number, lifetime: number) => {
        if (!this.isHost || !this.isMultiplayerGame) return;
        this.network.sendWallEffect({ x, z, dirX, dirZ, halfWidth, damage, lifetime });
      },
    );
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

    this.network.onPlayerSnapshot = (snap: PlayerSnapshot) => {
      if (this.isMultiplayerGame && !this.network.isHost) {
        this.applyPlayerSnapshot(snap);
      }
    };

    // ── Event-driven sync (clients receive from host) ──

    this.network.onEnemySpawn = (data: EnemySpawnEvent) => {
      if (!this.isClient) return;
      this.handleClientEnemySpawn(data);
    };

    this.network.onEnemyDie = (data: EnemyDieEvent) => {
      if (!this.isClient) return;
      this.handleClientEnemyDie(data);
    };

    this.network.onProjectileFire = (data: ProjectileFireEvent) => {
      if (!this.isClient) return;
      this.handleClientProjectileFire(data);
    };

    this.network.onPickupSpawn = (data: PickupSpawnEvent) => {
      if (!this.isClient) return;
      this.handleClientPickupSpawn(data);
    };

    this.network.onPickupCollected = (data: PickupCollectedEvent) => {
      if (!this.isClient) return;
      this.handleClientPickupCollected(data);
    };

    this.network.onAreaEffect = (data: AreaEffectEvent) => {
      if (!this.isClient) return;
      this.handleClientAreaEffect(data);
    };

    this.network.onWallEffect = (data: WallEffectEvent) => {
      if (!this.isClient) return;
      this.handleClientWallEffect(data);
    };

    this.network.onStateSync = (data: StateSyncEvent) => {
      if (!this.isClient) return;
      this.applyStateSync(data);
    };

    this.network.onDamageEvent = (data: DamageEventNet) => {
      if (!this.isClient) return;
      this.uiManager.showDamageAtWorldPos(data.x, data.z, data.damage, data.armor);
    };

    // Host starts selection → go to character select
    this.network.onStartSelection = () => {
      this.setState(GameState.CHARACTER_SELECT);
    };

    // All players ready → start game
    this.network.onGameStart = (players) => {
      const me = players.find((p) => p.id === this.network.myId);
      if (me?.characterId && me?.weaponId) {
        this.isMultiplayerGame = true;
        this.startGame(me.characterId, me.weaponId);
      }
    };

    // Game over from host
    this.network.onGameOver = () => {
      this.triggerGameOverSequence(false);
    };

    // Pause / resume coming from another player
    this.network.onRemotePause = () => {
      this.pauseGame(false);
    };
    this.network.onRemoteResume = () => {
      this.resumeGame(false);
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

  private gameOverTriggered: boolean = false;

  /** Shared game-over sequence: fade to black + audio (host sends network event) */
  private triggerGameOverSequence(isHost: boolean): void {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    this.audioManager.stopMusic();
    this.audioManager.playSfx("playerDeath");

    // Save highscore (solo only)
    if (!this.isMultiplayerGame) {
      this.lastHighScore = HighScoreManager.save({
        wave: this.getWave(),
        kills: this.getKillCount(),
        time: this.getGameTime(),
        level: this.getLevel(),
        characterId: this.selectedCharacter?.id ?? "unknown",
        weaponId: this.selectedWeaponId ?? "unknown",
      });
    }

    const fade = document.createElement("div");
    fade.className = "death-fade";
    document.getElementById("ui-root")!.appendChild(fade);

    setTimeout(() => {
      this.audioManager.playMusic("gameover");
      if (isHost) this.network.sendGameOver();
      this.setState(GameState.GAME_OVER);
      fade.remove();
    }, 1400);
  }

  setState(newState: GameState): void {
    const oldState = this.state;
    this.state = newState;
    this.uiManager.onStateChange(oldState, newState);

    // Handle music transitions
    if (newState === GameState.MAIN_MENU && oldState !== GameState.LOADING) {
      this.audioManager.playMusic("menu");
    }
  }

  selectCharacter(characterId: string): void {
    const charDef = CHARACTERS.find((c) => c.id === characterId);
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
    const charDef = CHARACTERS.find((c) => c.id === characterId);
    if (!charDef) return;

    this.selectedCharacter = charDef;
    this.selectedWeaponId = weaponId;
    this.resetGame();

    this.playerStats = {
      maxHp: charDef.hp,
      hp: charDef.hp,
      speed: charDef.speed,
      damage: 1,
      cooldownMultiplier: 1,
      magnetRadius: PLAYER_MAGNET_RADIUS,
      armor: 0,
      maxArmor: 0,
      projectileCount: 0,
    };

    if (this.isClient) {
      // CLIENT: visual entity with local weapon firing + collision
      this.playerEntity = createRemotePlayerVisual(this.app, characterId);
      this.playerEntity.name = "player";
      this.playerEntity.tags.add("player");
      this.collisionSystem.register(
        this.playerEntity,
        0.4,
        CollisionLayer.PLAYER,
      );
      // Enable local weapon firing for instant feedback
      this.combatSystem.setPlayer(this.playerEntity);
      const weaponDef = WEAPONS.find((w) => w.id === weaponId);
      if (weaponDef) this.combatSystem.addWeapon(weaponDef);
    } else {
      // HOST or SOLO: full player with scripts (identical to solo)
      this.playerEntity = createPlayer(this.app, charDef);
      this.collisionSystem.register(
        this.playerEntity,
        0.4,
        CollisionLayer.PLAYER,
      );
      this.combatSystem.setPlayer(this.playerEntity);
      const weaponDef = WEAPONS.find((w) => w.id === weaponId);
      if (weaponDef) this.combatSystem.addWeapon(weaponDef);

      if (this.isMultiplayerGame) this.spawnRemotePlayersOnHost();
    }

    const camFollow = this.cameraEntity?.script?.get("cameraFollow") as
      | CameraFollow
      | undefined;
    if (camFollow) camFollow.setTarget(this.playerEntity);

    this.setState(GameState.PLAYING);

    // Start character-specific game music
    this.audioManager.playGameMusic(characterId);
  }

  private spawnRemotePlayersOnHost(): void {
    for (const p of this.network.roomPlayers) {
      if (p.id === this.network.myId) continue;

      const charDef =
        CHARACTERS.find((c) => c.id === p.characterId) || CHARACTERS[0];
      const charId = p.characterId || charDef.id;
      const wepId = p.weaponId || WEAPONS[0].id;

      const entity = createRemotePlayerVisual(this.app, charId);
      entity.name = `remote_player_${p.id}`;
      entity.tags.add("player");
      entity.tags.add("remote_player");
      (entity as any).__playerId = p.id;
      (entity as any).__characterId = charId;

      this.remotePlayerEntities.set(p.id, entity);
      this.remotePlayerAlive.set(p.id, true);
      this.remotePlayerCharIds.set(p.id, charId);
      this.remotePlayerWeaponIds.set(p.id, wepId);
      this.collisionSystem.register(entity, 0.4, CollisionLayer.PLAYER);

      const stats: PlayerStats = {
        maxHp: charDef.hp,
        hp: charDef.hp,
        speed: charDef.speed,
        damage: 1,
        cooldownMultiplier: 1,
        magnetRadius: PLAYER_MAGNET_RADIUS,
        armor: 0,
        maxArmor: 0,
        projectileCount: 0,
      };
      this.remotePlayerStats.set(p.id, stats);

      this.remotePlayerGold.set(p.id, 0);
      this.remotePlayerShopBought.set(p.id, false);
      this.remotePlayerUpgrades.set(p.id, new UpgradeSystem());
      this.remotePlayerPendingLevelUps.set(p.id, 0);
      this.remotePlayerKills.set(p.id, 0);

      const weaponDef = WEAPONS.find((w) => w.id === wepId) || WEAPONS[0];
      this.combatSystem.addRemoteWeapon(p.id, weaponDef);
    }
  }

  /** Sync playerStats back to the entity's scripts (Health, PlayerController) */
  private syncStatsToEntity(): void {
    if (!this.playerEntity?.script) return;
    const controller = this.playerEntity.script.get("playerController") as any;
    if (controller) controller.speed = this.playerStats.speed;
    const health = this.playerEntity.script.get("health") as any;
    if (health) {
      health.maxHp = this.playerStats.maxHp;
      health.hp = this.playerStats.hp;
    }
  }

  selectUpgrade(upgradeId: string): void {
    // Stop level up SFX and resume game music
    this.audioManager.stopAllSfx();
    this.audioManager.resumeMusic();

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
    if (success) {
      this.audioManager.playSfx("shopBuy");
      this.syncStatsToEntity();
    }
    return success;
  }

  continueToNextWave(): void {
    if (this.state !== GameState.WAVE_END) return;

    this.audioManager.stopAllSfx();

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

  pauseGame(broadcast: boolean = true): void {
    if (this.state !== GameState.PLAYING) return;
    this.setState(GameState.PAUSED);
    if (broadcast && this.isMultiplayerGame) {
      this.network.sendPause();
    }
  }

  resumeGame(broadcast: boolean = true): void {
    if (this.state !== GameState.PAUSED) return;
    this.setState(GameState.PLAYING);
    if (broadcast && this.isMultiplayerGame) {
      this.network.sendResume();
    }
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
        this.registerNewEntities();

        if (this.isMultiplayerGame) {
          this.applyRemoteInputs(dt);
        }

        this.collisionSystem.update();
        this.combatSystem.update(
          dt,
          this.playerStats.cooldownMultiplier,
          this.playerStats.damage,
          this.playerStats.projectileCount,
        );
        this.waveSystem.update(dt);
        this.uiManager.updateHUD();

        if (this.isMultiplayerGame) {
          this.checkRemotePlayerDeaths();

          this.playerSnapshotTimer += dt;
          this.stateSyncTimer += dt;

          if (this.playerSnapshotTimer >= PLAYER_SNAPSHOT_INTERVAL) {
            this.playerSnapshotTimer = 0;
            this.broadcastPlayerSnapshot();
          }
          if (this.stateSyncTimer >= STATE_SYNC_INTERVAL) {
            this.stateSyncTimer = 0;
            this.broadcastStateSync();
          }
        }
      } else {
        // CLIENT: full local simulation + send input
        this.updateClientPrediction(dt);
        this.interpolateRemotePlayers(dt);
        this.registerNewEntities();
        this.combatSystem.update(
          dt,
          this.playerStats.cooldownMultiplier,
          this.playerStats.damage,
          this.playerStats.projectileCount,
        );
        this.collisionSystem.update();

        // Send input every frame BUT only when it actually changes — keeps the
        // host's authoritative state in sync without flooding the network.
        const input = this.inputManager.getState();
        const mx = input.moveDirection.x;
        const mz = input.moveDirection.y;
        const ax = input.aimDirection.x;
        const az = input.aimDirection.y;
        const last = this.lastInputSent;
        const changed =
          !last ||
          Math.abs(mx - last.mx) > 0.01 ||
          Math.abs(mz - last.mz) > 0.01 ||
          Math.abs(ax - last.ax) > 0.05 ||
          Math.abs(az - last.az) > 0.05;
        if (changed) {
          this.network.sendInput({ moveX: mx, moveZ: mz, aimX: ax, aimZ: az, fire: false });
          this.lastInputSent = { mx, mz, ax, az };
        }
        this.uiManager.updateHUD();
      }
    } else if (
      this.state === GameState.PAUSED ||
      this.state === GameState.LEVEL_UP ||
      this.state === GameState.WAVE_END
    ) {
      this.inputManager.update(this.playerEntity, this.cameraEntity);
      if (
        this.state === GameState.PAUSED &&
        this.inputManager.getState().pause
      ) {
        this.resumeGame();
      }
      // Keep sending state sync during WAVE_END/LEVEL_UP so clients see state updates
      if (
        (this.state === GameState.WAVE_END ||
          this.state === GameState.LEVEL_UP) &&
        this.isMultiplayerGame &&
        this.isHost
      ) {
        this.playerSnapshotTimer += dt;
        this.stateSyncTimer += dt;

        if (this.playerSnapshotTimer >= PLAYER_SNAPSHOT_INTERVAL) {
          this.playerSnapshotTimer = 0;
          this.broadcastPlayerSnapshot();
        }
        if (this.stateSyncTimer >= STATE_SYNC_INTERVAL) {
          this.stateSyncTimer = 0;
          this.broadcastStateSync();
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLIENT: PREDICTION & INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════

  /** Client-side prediction: move local player instantly based on input */
  private updateClientPrediction(dt: number): void {
    if (!this.playerEntity || !this.playerEntity.enabled || this.hostDead)
      return;

    const input = this.inputManager.getState();
    const speed = this.playerStats.speed || PLAYER_BASE_SPEED;
    const moveLen = Math.sqrt(
      input.moveDirection.x ** 2 + input.moveDirection.y ** 2,
    );
    if (moveLen > 0) {
      const nx = input.moveDirection.x / moveLen;
      const nz = input.moveDirection.y / moveLen;
      const pos = this.playerEntity.getPosition();
      const dx = nx * speed * dt;
      const dz = nz * speed * dt;

      let finalX = pos.x + dx;
      let finalZ = pos.z + dz;

      // Raycast against buildings (same as PlayerController / host remote input)
      const rigidbody = this.app.systems.rigidbody;
      if (rigidbody) {
        const radius = 0.5;
        const origin = new pc.Vec3(pos.x, pos.y + 0.5, pos.z);
        if (dx !== 0) {
          const targetX = new pc.Vec3(
            pos.x + dx + Math.sign(dx) * radius,
            pos.y + 0.5,
            pos.z,
          );
          if (rigidbody.raycastFirst(origin, targetX)) finalX = pos.x;
        }
        if (dz !== 0) {
          const targetZ = new pc.Vec3(
            pos.x,
            pos.y + 0.5,
            pos.z + dz + Math.sign(dz) * radius,
          );
          if (rigidbody.raycastFirst(origin, targetZ)) finalZ = pos.z;
        }
      }

      this.playerEntity.setPosition(
        Math.max(-39, Math.min(39, finalX)),
        pos.y,
        Math.max(-39, Math.min(39, finalZ)),
      );
    }
    if (input.aimDirection.x !== 0 || input.aimDirection.y !== 0) {
      const angle =
        Math.atan2(input.aimDirection.x, input.aimDirection.y) *
        (180 / Math.PI);
      this.playerEntity.setEulerAngles(0, angle, 0);
    }
  }

  /** Interpolate other players' positions from player snapshots (client only) */
  private interpolateRemotePlayers(dt: number): void {
    const lerpSpeed = 24;
    const t = Math.min(1, lerpSpeed * dt);

    for (const [, entity] of this.clientPlayerEntities) {
      if (!entity.enabled) continue;
      const tx = (entity as any).__targetX;
      const tz = (entity as any).__targetZ;
      const ta = (entity as any).__targetAngle;
      if (tx === undefined) continue;

      const snapshotTime = (entity as any).__snapshotTime ?? this.gameTime;
      const extrapolation = Math.min(Math.max(this.gameTime - snapshotTime, 0), 0.12);
      const vx = (entity as any).__velX ?? 0;
      const vz = (entity as any).__velZ ?? 0;
      const predictedX = tx + vx * extrapolation;
      const predictedZ = tz + vz * extrapolation;

      const pos = entity.getPosition();
      entity.setPosition(
        pos.x + (predictedX - pos.x) * t,
        0.5,
        pos.z + (predictedZ - pos.z) * t,
      );
      const isMoving =
        Math.abs(predictedX - pos.x) > 0.015 ||
        Math.abs(predictedZ - pos.z) > 0.015;
      this.updateRemoteAnimationState(entity, isMoving);
      if (ta !== undefined) {
        const cur = entity.getEulerAngles();
        entity.setEulerAngles(0, cur.y + this.angleDiff(cur.y, ta) * t, 0);
      }
    }
  }

  /** Shortest angle difference (handles wrap-around) */
  private angleDiff(from: number, to: number): number {
    let d = ((((to - from) % 360) + 540) % 360) - 180;
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
      const isMoving = len > 0.01;
      if (len > 0) {
        const nx = data.moveX / len;
        const nz = data.moveZ / len;
        const dx = nx * speed * dt;
        const dz = nz * speed * dt;

        let finalX = pos.x + dx;
        let finalZ = pos.z + dz;

        // Mirror PlayerController's collision raycast so remote players
        // are stopped by buildings the same way local prediction is.
        const rigidbody = this.app.systems.rigidbody;
        if (rigidbody) {
          const origin = new pc.Vec3(pos.x, pos.y + 0.5, pos.z);
          const rayOptions = { filterCollisionMask: pc.BODYMASK_ALL & ~pc.BODYGROUP_USER_1 };
          if (dx !== 0) {
            const tX = new pc.Vec3(pos.x + dx + Math.sign(dx) * 0.5, pos.y + 0.5, pos.z);
            if (rigidbody.raycastFirst(origin, tX, rayOptions)) finalX = pos.x;
          }
          if (dz !== 0) {
            const tZ = new pc.Vec3(pos.x, pos.y + 0.5, pos.z + dz + Math.sign(dz) * 0.5);
            if (rigidbody.raycastFirst(origin, tZ, rayOptions)) finalZ = pos.z;
          }
        }

        entity.setPosition(
          Math.max(-39, Math.min(39, finalX)),
          pos.y,
          Math.max(-39, Math.min(39, finalZ)),
        );
      }
      this.updateRemoteAnimationState(entity, isMoving);

      if (data.aimX !== 0 || data.aimZ !== 0) {
        const angle = Math.atan2(data.aimX, data.aimZ) * (180 / Math.PI);
        entity.setEulerAngles(0, angle, 0);
      }

      // Auto-fire: remote players fire automatically (same as local player)
      this.combatSystem.fireForRemotePlayer(
        entity,
        data.aimX,
        data.aimZ,
        stats?.damage || 1,
        stats?.projectileCount || 0,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLIENT: LOCAL FIRE PREDICTION
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  HOST: SNAPSHOT BROADCAST
  // ═══════════════════════════════════════════════════════════════════

  private broadcastPlayerSnapshot(): void {
    if (!this.playerEntity) return;

    const pos = this.playerEntity.getPosition();
    const ang = this.playerEntity.getEulerAngles();
    const globalLevel = this.xpSystem.currentLevel;
    const globalXpProgress = this.xpSystem.getProgress();

    const players: PlayerNetState[] = [
      {
        id: this.network.myId!,
        characterId: this.selectedCharacter?.id || "trump",
        alive: !this.hostDead,
        level: globalLevel,
        xpProgress: globalXpProgress,
        gold: this.shopSystem.gold,
        kills: this.hostKills,
        pendingLevelUps: this.hostPendingLevelUps,
        x: pos.x,
        z: pos.z,
        angle: ang.y,
        hp: this.playerStats.hp,
        maxHp: this.playerStats.maxHp,
        armor: this.playerStats.armor,
        maxArmor: this.playerStats.maxArmor,
        speed: this.playerStats.speed,
      },
    ];

    for (const [playerId, entity] of this.remotePlayerEntities) {
      const rp = entity.getPosition();
      const ra = entity.getEulerAngles();
      const stats = this.remotePlayerStats.get(playerId);
      const alive = this.remotePlayerAlive.get(playerId) ?? true;
      players.push({
        id: playerId,
        characterId: (entity as any).__characterId || "trump",
        alive,
        level: globalLevel,
        xpProgress: globalXpProgress,
        gold: this.remotePlayerGold.get(playerId) ?? 0,
        kills: this.remotePlayerKills.get(playerId) ?? 0,
        pendingLevelUps: this.remotePlayerPendingLevelUps.get(playerId) ?? 0,
        x: rp.x,
        z: rp.z,
        angle: ra.y,
        hp: stats?.hp ?? 100,
        maxHp: stats?.maxHp ?? 100,
        armor: stats?.armor ?? 0,
        maxArmor: stats?.maxArmor ?? 0,
        speed: stats?.speed ?? 8,
      });
    }

    this.network.sendPlayerSnapshot({
      tick: Math.floor(this.gameTime * 30),
      gameTime: this.gameTime,
      players,
    });
  }

  /** Lightweight state sync — metadata only, no entity positions */
  private broadcastStateSync(): void {
    this.network.sendStateSync({
      gameTime: this.gameTime,
      state: this.state,
      wave: this.waveSystem.currentWave,
      completedWave: this.completedWave,
      killCount: this.killCount,
      nightFactor: (this.app as any).__nightFactor ?? 0,
      timeOfDay: (this.app as any).__timeOfDay ?? 0,
      readyPlayers: Array.from(this.readyPlayers),
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLIENT: APPLY SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════

  private applyPlayerSnapshot(snap: PlayerSnapshot): void {
    this.gameTime = snap.gameTime;

    // Update local player from host's authoritative state
    const myState = snap.players.find((p) => p.id === this.network.myId);
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
        // Reconcile with the host's authoritative position.
        // Client predicts every frame, then nudges toward the server pos.
        const currentPos = this.playerEntity.getPosition();
        const dx = myState.x - currentPos.x;
        const dz = myState.z - currentPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 8.0) {
          // Catastrophic desync (respawn, teleport, lag spike) — snap.
          this.playerEntity.setPosition(myState.x, 0.5, myState.z);
        } else if (dist > 0.05) {
          // Gentle exponential pull (~12% per snapshot) so small lags
          // don't manifest as visible teleporting.
          this.playerEntity.setPosition(
            currentPos.x + dx * 0.12,
            0.5,
            currentPos.z + dz * 0.12,
          );
        }
      }
      const input = this.inputManager.getState();
      const movingLocal =
        Math.abs(input.moveDirection.x) > 0.01 ||
        Math.abs(input.moveDirection.y) > 0.01;
      this.updateRemoteAnimationState(this.playerEntity, movingLocal);
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
        const prevX = (entity as any).__targetX;
        const prevZ = (entity as any).__targetZ;
        const prevSnapshotTime =
          (entity as any).__snapshotTime ?? snap.gameTime;
        const snapshotDt = Math.max(snap.gameTime - prevSnapshotTime, 0.001);

        // Store targets for interpolation
        (entity as any).__targetX = pState.x;
        (entity as any).__targetZ = pState.z;
        (entity as any).__targetAngle = pState.angle;
        (entity as any).__snapshotTime = snap.gameTime;
        (entity as any).__velX = (pState.x - (prevX ?? pState.x)) / snapshotDt;
        (entity as any).__velZ = (pState.z - (prevZ ?? pState.z)) / snapshotDt;
        // Snap if first frame (no previous position set)
        if ((entity as any).__interpReady === undefined) {
          entity.setPosition(pState.x, 0.5, pState.z);
          entity.setEulerAngles(0, pState.angle, 0);
          (entity as any).__interpReady = true;
        }
      }
    }

    // Remove disconnected/absent remote players
    for (const [pid, entity] of this.clientPlayerEntities) {
      if (!activePlayerIds.has(pid)) {
        entity.destroy();
        this.clientPlayerEntities.delete(pid);
      }
    }
  }

  private updateRemoteAnimationState(entity: pc.Entity, isMoving: boolean): void {
    const modelEntity = (entity as any).__modelEntity as pc.Entity | undefined;
    if (!modelEntity || !(entity as any).__hasAnims || !modelEntity.anim) return;

    const layer = modelEntity.anim.baseLayer;
    if (!layer) return;

    const targetState = isMoving ? "run" : "idle";
    if (layer.activeState !== targetState) {
      layer.transition(targetState, 0.12);
    }
  }

  /** Client: apply lightweight state sync from host */
  private applyStateSync(data: StateSyncEvent): void {
    this.gameTime = data.gameTime;
    this.killCount = data.killCount;
    this.waveSystem.currentWave = data.wave;
    this.completedWave = data.completedWave ?? this.completedWave;
    (this.app as any).__nightFactor = data.nightFactor;
    (this.app as any).__timeOfDay = data.timeOfDay;

    // Sync ready players list
    this.readyPlayers = new Set(data.readyPlayers || []);

    // Sync game state from host (PLAYING ↔ WAVE_END ↔ LEVEL_UP transitions)
    const hostState = data.state as GameState;
    if (hostState && hostState !== this.state) {
      const allowed: GameState[] = [
        GameState.PLAYING,
        GameState.WAVE_END,
        GameState.LEVEL_UP,
      ];
      if (allowed.includes(hostState) && allowed.includes(this.state)) {
        this.setState(hostState);
      }
    }
  }

  private createClientPlayerEntity(
    playerId: string,
    characterId: string,
  ): pc.Entity {
    const entity = createRemotePlayerVisual(this.app, characterId);
    entity.name = `client_player_${playerId}`;
    entity.tags.add("player"); // So EnemyAI can target all players
    return entity;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLIENT: EVENT-DRIVEN HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  /** Client: spawn a real enemy with AI (same as host) */
  private handleClientEnemySpawn(data: EnemySpawnEvent): void {
    const baseDef = ENEMIES.find((e) => e.id === data.defId) || ENEMIES[0];
    const modifiedDef = {
      ...baseDef,
      hp: data.hp,
      damage: data.damage,
      speed: data.speed,
      scale: data.scale,
    };
    const entity = createEnemy(this.app, modifiedDef, new pc.Vec3(data.x, 0, data.z));
    this.clientEntities.set(data.nid, entity);
  }

  /** Client: handle enemy death from host */
  private handleClientEnemyDie(data: EnemyDieEvent): void {
    const entity = this.clientEntities.get(data.nid);
    if (!entity) return;

    // Mark as dead so auto-aim and AI skip this enemy
    (entity as any).__deathProcessed = true;

    this.audioManager.playSfx("enemyDeath");

    // Disable AI so it stops moving
    const ai = entity.script?.get("enemyAI");
    if (ai instanceof EnemyAI) ai.enabled = false;
    this.collisionSystem.unregister(entity);

    // Play death animation
    const modelEntity = (entity as any).__modelEntity as pc.Entity | undefined;
    if (modelEntity?.anim?.baseLayer) {
      modelEntity.anim.baseLayer.transition("die", 0.1);
    }

    this.clientEntities.delete(data.nid);
    const hasAnims = (entity as any).__hasAnims;
    setTimeout(() => { if (entity.parent) entity.destroy(); }, hasAnims ? 2000 : 50);
  }

  /** Client: create a projectile fired by another player */
  private handleClientProjectileFire(data: ProjectileFireEvent): void {
    // Skip projectiles from self — client fires own weapons locally
    if (data.playerId === this.network.myId) return;

    const pos = new pc.Vec3(data.x, 0.5, data.z);
    const dir = new pc.Vec3(data.dirX, 0, data.dirZ);
    createProjectile(
      this.app, pos, dir,
      data.speed, data.lifetime, data.damage,
      undefined, data.isEnemy,
      data.modelPath, data.modelScale,
      data.text,
    );
  }

  /** Client: spawn a real pickup with magnet behavior */
  private handleClientPickupSpawn(data: PickupSpawnEvent): void {
    const entity = createXPPickup(this.app, new pc.Vec3(data.x, 0.5, data.z), data.xpValue);
    this.clientEntities.set(data.nid, entity);
  }

  /** Client: destroy a collected pickup */
  private handleClientPickupCollected(data: PickupCollectedEvent): void {
    const entity = this.clientEntities.get(data.nid);
    if (entity) {
      this.audioManager.playSfx("xpPickup");
      this.collisionSystem.unregister(entity);
      entity.destroy();
      this.clientEntities.delete(data.nid);
    }
  }

  /** Client: show area effect visual (mirrors CombatSystem.fireArea visuals) */
  private handleClientAreaEffect(data: AreaEffectEvent): void {
    const radius = data.radius;
    const area = new pc.Entity("area_effect");
    area.setPosition(data.x, 0.1, data.z);
    area.tags.add("area_effect");
    this.app.root.addChild(area);

    // Use the explosion GLB model (same as host/solo)
    const explosionAsset = getCachedModel("assets/explosion/explosion.glb");
    let visualLifetime = 300;

    if (explosionAsset) {
      const container = explosionAsset.resource as any;
      const visual = container.instantiateRenderEntity() as pc.Entity;
      const modelScale = radius / 60;
      visual.setLocalScale(modelScale, modelScale, modelScale);
      visual.setLocalPosition(0, 0, 16 * modelScale);
      area.addChild(visual);

      const anims = (container as any).animations as pc.Asset[] | undefined;
      if (anims && anims.length > 0) {
        visual.addComponent("anim", { activate: true, speed: 1 });
        const track = anims[0].resource as pc.AnimTrack;
        if (track) {
          visual.anim!.loadStateGraph(
            new pc.AnimStateGraph({
              layers: [
                {
                  name: "Base",
                  states: [
                    { name: "START", speed: 1 },
                    { name: "play", speed: 1, loop: false },
                  ],
                  transitions: [
                    { from: "START", to: "play", time: 0, conditions: [] },
                  ],
                },
              ],
              parameters: {},
            }),
          );
          visual.anim!.assignAnimation("play", track);
          visualLifetime = Math.min(
            2000,
            Math.max(800, (track.duration || 1) * 1000),
          );
        }
      }
    } else {
      // Fallback: glowing cylinder
      area.addComponent("render", { type: "cylinder" });
      area.setLocalScale(radius * 2, 0.2, radius * 2);
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(1, 0.5, 0.2);
      mat.emissive = new pc.Color(1, 0.3, 0.1);
      mat.emissiveIntensity = 3;
      mat.opacity = 0.5;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.update();
      for (const mi of area.render!.meshInstances) mi.material = mat;
    }

    setTimeout(() => {
      if (area.parent) area.destroy();
    }, visualLifetime);
  }

  /** Client: show wall effect visual (mirrors CombatSystem.fireWall visuals) */
  private handleClientWallEffect(data: WallEffectEvent): void {
    const wall = new pc.Entity("wall");
    wall.setPosition(data.x, 0, data.z);
    const yaw = Math.atan2(data.dirX, data.dirZ) * (180 / Math.PI);
    wall.setLocalEulerAngles(0, yaw + 90, 0);

    // Use the wall GLB model (same as host/solo)
    const wallAsset = getCachedModel("assets/wall/wall.glb");
    if (wallAsset) {
      const container = wallAsset.resource as any;
      const visual = container.instantiateRenderEntity() as pc.Entity;
      const scaleX = (data.halfWidth * 2) / 3.3;
      visual.setLocalScale(scaleX, 1.5, 1);
      wall.addChild(visual);
    } else {
      // Fallback box
      wall.addComponent("render", { type: "box" });
      wall.setLocalScale(data.halfWidth * 2, 1.5, 1);
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(0.45, 0.30, 0.15);
      mat.update();
      for (const mi of wall.render!.meshInstances) mi.material = mat;
    }

    wall.tags.add("wall_effect");
    this.app.root.addChild(wall);
    setTimeout(() => {
      if (wall.parent) wall.destroy();
    }, (data.lifetime || 2) * 1000);
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
      this.triggerGameOverSequence(true);
    }
  }

  /** Switch camera to the first alive player entity (spectator mode) */
  private switchCameraToAlivePlayer(): void {
    const camFollow = this.cameraEntity?.script?.get("cameraFollow") as
      | CameraFollow
      | undefined;
    if (!camFollow) return;

    // Host side: find alive remote entity
    for (const [pid, alive] of this.remotePlayerAlive) {
      if (alive) {
        const entity = this.remotePlayerEntities.get(pid);
        if (entity) {
          camFollow.setTarget(entity);
          return;
        }
      }
    }

    // Client side: find alive client player entity
    for (const [, entity] of this.clientPlayerEntities) {
      if (entity.enabled) {
        camFollow.setTarget(entity);
        return;
      }
    }
  }

  /** Restore camera to own player after respawn */
  private restoreCameraToSelf(): void {
    if (!this.playerEntity) return;
    const camFollow = this.cameraEntity?.script?.get("cameraFollow") as
      | CameraFollow
      | undefined;
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
      this.collisionSystem.register(
        this.playerEntity,
        0.4,
        CollisionLayer.PLAYER,
      );
      this.syncStatsToEntity();
      // Reset Health script's isDead flag so the player can take damage again
      const health = this.playerEntity.script?.get("health") as any;
      if (health) {
        health.isDead = false;
        health.hp = this.playerStats.maxHp;
      }
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
        const charId = this.remotePlayerCharIds.get(playerId) || "trump";
        entity = createRemotePlayerVisual(this.app, charId);
        entity.name = `remote_player_${playerId}`;
        entity.tags.add("player");
        entity.tags.add("remote_player");
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

    const item = this.shopSystem.getItems().find((i) => i.id === itemId);
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
    for (const enemy of this.app.root.findByTag("enemy") as pc.Entity[]) {
      if ((enemy as any).__collisionId === undefined) {
        const def = (enemy as any).__enemyDef;
        this.collisionSystem.register(
          enemy,
          def ? def.scale * 0.5 : 0.4,
          CollisionLayer.ENEMY,
        );
      }
    }
    for (const proj of this.app.root.findByTag(
      "player_projectile",
    ) as pc.Entity[]) {
      if ((proj as any).__collisionId === undefined) {
        this.collisionSystem.register(
          proj,
          0.15,
          CollisionLayer.PLAYER_PROJECTILE,
        );
      }
    }
    for (const proj of this.app.root.findByTag(
      "enemy_projectile",
    ) as pc.Entity[]) {
      if ((proj as any).__collisionId === undefined) {
        this.collisionSystem.register(
          proj,
          0.15,
          CollisionLayer.ENEMY_PROJECTILE,
        );
      }
    }
    for (const pickup of this.app.root.findByTag("xp_pickup") as pc.Entity[]) {
      if ((pickup as any).__collisionId === undefined) {
        this.collisionSystem.register(pickup, 0.3, CollisionLayer.PICKUP);
      }
    }
  }

  private handleCollision(
    a: pc.Entity,
    b: pc.Entity,
    layerA: CollisionLayer,
    layerB: CollisionLayer,
  ): void {
    // Projectile hits enemy
    if (
      layerA === CollisionLayer.PLAYER_PROJECTILE &&
      layerB === CollisionLayer.ENEMY
    ) {
      if (this.isHost) {
        // Host: full damage logic
        const projScript = a.script?.get("projectile") as any;
        const healthScript = b.script?.get("health") as any;
        if (projScript && healthScript) {
          const ownerId = (a as any).__ownerId;
          if (ownerId) (b as any).__lastAttacker = ownerId;
          healthScript.takeDamage(projScript.damage, false);
        }
      }
      // Both host and client: destroy the projectile visually
      this.collisionSystem.unregister(a);
      const nid = this.entityNetIds.get(a);
      if (nid !== undefined) {
        this.entityNetIds.delete(a);
        this.netIdEntities.delete(nid);
      }
      a.destroy();
      return;
    }

    // Enemy touches player — only host applies damage
    if (layerA === CollisionLayer.ENEMY && layerB === CollisionLayer.PLAYER) {
      if (this.isClient) return; // Client: no damage, host handles via HP sync

      const enemyAI = a.script?.get("enemyAI");
      if (!(enemyAI instanceof EnemyAI) || !enemyAI.canDealContactDamage())
        return;

      let damage = enemyAI.contactDamage;

      if (b === this.playerEntity) {
        // Local player
        let armorHit = false;
        if (this.playerStats.armor > 0) {
          armorHit = true;
          if (this.playerStats.armor >= damage) {
            this.playerStats.armor -= damage;
            this.app.fire("damage:dealt", b, damage, true);
            enemyAI.resetContactCooldown();
            return;
          }
          damage -= this.playerStats.armor;
          this.playerStats.armor = 0;
        }
        const playerHealth = b.script?.get("health") as Health | undefined;
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
                this.app.fire("damage:dealt", b, damage, true);
                enemyAI.resetContactCooldown();
                return;
              }
              damage -= stats.armor;
              stats.armor = 0;
            }
            stats.hp = Math.max(0, stats.hp - damage);
            this.app.fire("damage:dealt", b, damage, armorHit);
          }
        }
      }
      enemyAI.resetContactCooldown();
    }

    // XP pickup — ALL XP goes to the shared global pool
    if (layerA === CollisionLayer.PICKUP && layerB === CollisionLayer.PLAYER) {
      if (this.isClient) {
        // Client: destroy pickup visually + play SFX, host handles XP
        this.audioManager.playSfx("xpPickup");
        this.collisionSystem.unregister(a);
        const nid = this.findClientNid(a);
        if (nid !== undefined) this.clientEntities.delete(nid);
        a.destroy();
        return;
      }
      const xpScript = a.script?.get("xpPickup") as XPPickup | undefined;
      if (xpScript) {
        this.app.fire("xp:collected", xpScript.xpValue);
        this.collisionSystem.unregister(a);
        const nid = this.entityNetIds.get(a);
        if (nid !== undefined) {
          if (this.isMultiplayerGame) {
            this.network.sendPickupCollected({ nid });
          }
          this.entityNetIds.delete(a);
          this.netIdEntities.delete(nid);
        }
        a.destroy();
      }
    }

    // Enemy projectile hits player
    if (
      layerA === CollisionLayer.ENEMY_PROJECTILE &&
      layerB === CollisionLayer.PLAYER
    ) {
      if (this.isHost) {
        // Host: full damage logic
        const projScript = a.script?.get("projectile") as any;
        if (!projScript) return;
        let damage = projScript.damage as number;

        if (b === this.playerEntity) {
          let armorHit = false;
          if (this.playerStats.armor > 0) {
            armorHit = true;
            if (this.playerStats.armor >= damage) {
              this.playerStats.armor -= damage;
              this.app.fire("damage:dealt", b, damage, true);
              this.collisionSystem.unregister(a);
              a.destroy();
              return;
            }
            damage -= this.playerStats.armor;
            this.playerStats.armor = 0;
          }
          const playerHealth = b.script?.get("health") as Health | undefined;
          if (playerHealth) {
            playerHealth.takeDamage(damage, armorHit);
            this.playerStats.hp = playerHealth.hp;
          }
        }
      }
      // Both host and client: destroy the projectile visually
      this.collisionSystem.unregister(a);
      a.destroy();
    }
  }

  /** Find a client entity's nid by entity reference */
  private findClientNid(entity: pc.Entity): number | undefined {
    for (const [nid, e] of this.clientEntities) {
      if (e === entity) return nid;
    }
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESET
  // ═══════════════════════════════════════════════════════════════════

  private resetGame(): void {
    this.gameOverTriggered = false;
    this.lastHighScore = null;
    this.gameTime = 0;
    this.killCount = 0;
    this.completedWave = 0;
    this.hostKills = 0;
    this.remotePlayerKills.clear();
    this.clientKills = 0;
    this.clientLevel = 1;
    this.clientXpProgress = 0;
    this.clientGold = 0;
    this.playerSnapshotTimer = 0;
    this.stateSyncTimer = 0;
    nextNetId = 1;

    for (const e of this.app.root.findByTag("enemy")) e.destroy();
    for (const e of this.app.root.findByTag("projectile")) e.destroy();
    for (const e of this.app.root.findByTag("pickup")) e.destroy();
    for (const e of this.app.root.findByTag("area_effect")) e.destroy();
    for (const e of this.app.root.findByTag("remote_player")) e.destroy();

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

    if (this.playerEntity) {
      this.playerEntity.destroy();
      this.playerEntity = null;
    }

    this.collisionSystem.clear();
    this.combatSystem.clear();
    this.waveSystem.reset();
    this.xpSystem.reset();
    this.upgradeSystem.reset();
    this.shopSystem.reset();

    // Reset day/night cycle to start of day
    (this.app as any).__timeOfDay = 0;
    (this.app as any).__nightFactor = 0;
    const dayNight = this.lightEntity?.script?.get("dayNightCycle") as
      | DayNightCycle
      | undefined;
    if (dayNight) {
      dayNight.timeOfDay = 0;
      dayNight["applyColors"](0);
    }
  }

  private defaultStats(): PlayerStats {
    return {
      maxHp: PLAYER_BASE_HP,
      hp: PLAYER_BASE_HP,
      speed: PLAYER_BASE_SPEED,
      damage: 1,
      cooldownMultiplier: 1,
      magnetRadius: PLAYER_MAGNET_RADIUS,
      armor: 0,
      maxArmor: 0,
      projectileCount: 0,
    };
  }

  // Getters for UI
  getHP(): number {
    return this.playerStats.hp;
  }
  getMaxHP(): number {
    return this.playerStats.maxHp;
  }
  getLevel(): number {
    return this.isClient ? this.clientLevel : this.xpSystem.currentLevel;
  }
  getXPProgress(): number {
    return this.isClient ? this.clientXpProgress : this.xpSystem.getProgress();
  }
  getWave(): number {
    return this.waveSystem.currentWave;
  }
  getGameTime(): number {
    return this.gameTime;
  }
  getKillCount(): number {
    return this.isClient ? this.clientKills : this.hostKills;
  }
  getTeamKillCount(): number {
    return this.killCount;
  }
  getArmor(): number {
    return this.playerStats.armor;
  }
  getMaxArmor(): number {
    return this.playerStats.maxArmor;
  }
  getGold(): number {
    return this.isClient ? this.clientGold : this.shopSystem.gold;
  }
  isSpectating(): boolean {
    return this.isMultiplayerGame && this.hostDead;
  }
  getReadyCount(): number {
    return this.readyPlayers.size;
  }
  getTotalPlayerCount(): number {
    return this.isMultiplayerGame
      ? 1 + this.remotePlayerEntities.size + this.clientPlayerEntities.size
      : 1;
  }
  isPlayerReady(playerId: string): boolean {
    return this.readyPlayers.has(playerId);
  }
  isSelfReady(): boolean {
    return this.readyPlayers.has(this.network.myId || "");
  }

  // Getters for nametags (UI needs access to player entities)
  getPlayerEntity(): pc.Entity | null {
    return this.playerEntity;
  }
  getRemotePlayerEntities(): Map<string, pc.Entity> {
    return this.remotePlayerEntities;
  }
  getClientPlayerEntities(): Map<string, pc.Entity> {
    return this.clientPlayerEntities;
  }
}
