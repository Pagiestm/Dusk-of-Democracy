import * as pc from 'playcanvas';
import { GameState, CollisionLayer, PLAYER_BASE_HP, PLAYER_BASE_SPEED, PLAYER_MAGNET_RADIUS } from '../constants';
import { PlayerStats, CharacterDef } from '../types';
import { InputManager } from './InputManager';
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

export class Game {
    app: pc.Application;
    state: GameState = GameState.LOADING;
    inputManager: InputManager;

    // Scene entities
    private cameraEntity: pc.Entity | null = null;
    private lightEntity: pc.Entity | null = null;
    private playerEntity: pc.Entity | null = null;

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

    constructor(app: pc.Application) {
        this.app = app;
        (app as any).__game = this;

        this.inputManager = new InputManager(app);

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

        // Listen for game events
        this.setupEvents();
    }

    init(): void {
        // Setup scene
        const { camera, light } = setupScene(this.app);
        this.cameraEntity = camera;
        this.lightEntity = light;

        // Add camera follow script
        this.cameraEntity.addComponent('script');
        this.cameraEntity.script!.create(CameraFollow);

        // Add day/night cycle to light
        this.lightEntity.addComponent('script');
        this.lightEntity.script!.create(DayNightCycle);

        // Show main menu
        this.setState(GameState.MAIN_MENU);
    }

    private setupEvents(): void {
        // Enemy died
        this.app.on('enemy:died', (entity: pc.Entity, _xpReward: number) => {
            this.killCount++;
            this.shopSystem.addGold(Math.floor(Math.random() * 5) + 1);

            // Unregister from collision
            this.collisionSystem.unregister(entity);

            // Destroy enemy after brief delay (for death effect)
            setTimeout(() => {
                if (entity.parent) entity.destroy();
            }, 50);
        });

        // XP collected
        this.app.on('xp:collected', (_amount: number) => {
            // XPSystem handles the XP logic
        });

        // Player level up
        this.app.on('player:levelup', (_level: number) => {
            if (this.state === GameState.PLAYING) {
                this.setState(GameState.LEVEL_UP);
            }
        });

        // Player died
        this.app.on('player:died', () => {
            this.setState(GameState.GAME_OVER);
        });
    }

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

        // Reset everything
        this.resetGame();

        // Setup player stats from character
        this.playerStats = {
            maxHp: charDef.hp,
            hp: charDef.hp,
            speed: charDef.speed,
            damage: 1,
            cooldownMultiplier: 1,
            magnetRadius: PLAYER_MAGNET_RADIUS,
            armor: 0,
            projectileCount: 0,
        };

        // Create player entity
        this.playerEntity = createPlayer(this.app, charDef);

        // Register player collision
        this.collisionSystem.register(this.playerEntity, 0.4, CollisionLayer.PLAYER);

        // Set camera target
        const camFollow = this.cameraEntity?.script?.get('cameraFollow') as CameraFollow | undefined;
        if (camFollow) {
            camFollow.setTarget(this.playerEntity);
        }

        // Add starting weapon (chosen by the player at selection screen)
        this.combatSystem.setPlayer(this.playerEntity);
        const weaponDef = WEAPONS.find(w => w.id === weaponId);
        if (weaponDef) {
            this.combatSystem.addWeapon(weaponDef);
        }

        this.setState(GameState.PLAYING);
    }

    selectUpgrade(upgradeId: string): void {
        this.upgradeSystem.applyUpgrade(upgradeId, this.playerStats);

        // Apply speed to player controller
        if (this.playerEntity?.script) {
            const controller = this.playerEntity.script.get('playerController') as any;
            if (controller) {
                controller.speed = this.playerStats.speed;
            }

            // Apply HP changes
            const health = this.playerEntity.script.get('health') as any;
            if (health) {
                health.maxHp = this.playerStats.maxHp;
                health.hp = this.playerStats.hp;
            }
        }

        this.setState(GameState.PLAYING);
    }

    pauseGame(): void {
        if (this.state === GameState.PLAYING) {
            this.setState(GameState.PAUSED);
        }
    }

    resumeGame(): void {
        if (this.state === GameState.PAUSED) {
            this.setState(GameState.PLAYING);
        }
    }

    private update(dt: number): void {
        if (this.state === GameState.PLAYING) {
            this.gameTime += dt;

            // Update input
            this.inputManager.update(this.playerEntity, this.cameraEntity);

            // Check pause
            if (this.inputManager.getState().pause) {
                this.pauseGame();
                return;
            }

            // Register new enemies and projectiles for collision
            this.registerNewEntities();

            // Update systems
            this.collisionSystem.update();
            this.combatSystem.update(
                dt,
                this.playerStats.cooldownMultiplier,
                this.playerStats.damage,
                this.playerStats.projectileCount
            );
            this.waveSystem.update(dt);

            // Update HUD
            this.uiManager.updateHUD();

        } else if (this.state === GameState.PAUSED || this.state === GameState.LEVEL_UP) {
            // Still poll input for unpause
            this.inputManager.update(this.playerEntity, this.cameraEntity);
            if (this.state === GameState.PAUSED && this.inputManager.getState().pause) {
                this.resumeGame();
            }
        }
    }

    private registerNewEntities(): void {
        // Register unregistered enemies
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const enemy of enemies) {
            if ((enemy as any).__collisionId === undefined) {
                const def = (enemy as any).__enemyDef;
                const radius = def ? def.scale * 0.5 : 0.4;
                this.collisionSystem.register(enemy, radius, CollisionLayer.ENEMY);
            }
        }

        // Register unregistered projectiles
        const projectiles = this.app.root.findByTag('player_projectile') as pc.Entity[];
        for (const proj of projectiles) {
            if ((proj as any).__collisionId === undefined) {
                this.collisionSystem.register(proj, 0.15, CollisionLayer.PLAYER_PROJECTILE);
            }
        }

        // Register unregistered pickups
        const pickups = this.app.root.findByTag('xp_pickup') as pc.Entity[];
        for (const pickup of pickups) {
            if ((pickup as any).__collisionId === undefined) {
                this.collisionSystem.register(pickup, 0.3, CollisionLayer.PICKUP);
            }
        }
    }

    private handleCollision(
        a: pc.Entity,
        b: pc.Entity,
        layerA: CollisionLayer,
        layerB: CollisionLayer
    ): void {
        // Projectile hits enemy
        if (layerA === CollisionLayer.PLAYER_PROJECTILE && layerB === CollisionLayer.ENEMY) {
            const projScript = a.script?.get('projectile') as any;
            const healthScript = b.script?.get('health') as any;
            if (projScript && healthScript) {
                healthScript.takeDamage(projScript.damage, 0);
                // Destroy projectile
                this.collisionSystem.unregister(a);
                a.destroy();
            }
        }

        // Enemy touches player
        if (layerA === CollisionLayer.ENEMY && layerB === CollisionLayer.PLAYER) {
            const enemyAI = a.script?.get('enemyAI') as EnemyAI | undefined;
            const playerHealth = b.script?.get('health') as Health | undefined;
            if (enemyAI && playerHealth && enemyAI.canDealContactDamage()) {
                playerHealth.takeDamage(enemyAI.contactDamage, this.playerStats.armor);
                enemyAI.resetContactCooldown();

                // Update stats
                this.playerStats.hp = playerHealth.hp;
            }
        }

        // Player picks up XP
        if (layerA === CollisionLayer.PICKUP && layerB === CollisionLayer.PLAYER) {
            const xpScript = a.script?.get('xpPickup') as XPPickup | undefined;
            if (xpScript) {
                this.app.fire('xp:collected', xpScript.xpValue);
                this.collisionSystem.unregister(a);
                a.destroy();
            }
        }
    }

    private resetGame(): void {
        this.gameTime = 0;
        this.killCount = 0;

        // Destroy old entities
        const enemies = this.app.root.findByTag('enemy');
        for (const e of enemies) e.destroy();

        const projectiles = this.app.root.findByTag('projectile');
        for (const e of projectiles) e.destroy();

        const pickups = this.app.root.findByTag('pickup');
        for (const e of pickups) e.destroy();

        const areaEffects = this.app.root.findByTag('area_effect');
        for (const e of areaEffects) e.destroy();

        if (this.playerEntity) {
            this.playerEntity.destroy();
            this.playerEntity = null;
        }

        // Reset systems
        this.collisionSystem.clear();
        this.combatSystem.clear();
        this.waveSystem.reset();
        this.xpSystem.reset();
        this.upgradeSystem.reset();
        this.shopSystem.reset();
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
            projectileCount: 0,
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
    getGold(): number { return this.shopSystem.gold; }
}
