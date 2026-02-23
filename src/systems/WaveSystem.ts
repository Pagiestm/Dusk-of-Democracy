import * as pc from 'playcanvas';
import { WAVES } from '../data/waves';
import { ENEMIES } from '../data/enemies';
import { createEnemy } from '../entities/EnemyFactory';
import { ENEMY_SPAWN_DISTANCE, ARENA_HALF, NIGHT_SPAWN_MULTIPLIER } from '../constants';
import { EnemyDef, WaveDef, WaveEnemyGroup } from '../types';

export class WaveSystem {
    private app: pc.Application;
    private waveIndex: number = 0;
    private spawnTimer: number = 0;
    private waveTimer: number = 0;
    private spawnQueue: EnemyDef[] = [];
    private enemyDefMap: Map<string, EnemyDef>;

    currentWave: number = 1;
    totalEnemiesAlive: number = 0;

    constructor(app: pc.Application) {
        this.app = app;

        // Build lookup map
        this.enemyDefMap = new Map();
        for (const def of ENEMIES) {
            this.enemyDefMap.set(def.id, def);
        }

        // Track enemy deaths
        this.app.on('enemy:died', () => {
            this.totalEnemiesAlive = Math.max(0, this.totalEnemiesAlive - 1);
        });
    }

    update(dt: number): void {
        if (this.waveIndex >= WAVES.length) {
            // Loop waves with scaling
            this.waveIndex = 0;
        }

        const waveDef = WAVES[this.waveIndex];
        this.currentWave = waveDef.wave;

        // Advance wave timer
        this.waveTimer += dt;

        // Fill spawn queue if empty
        if (this.spawnQueue.length === 0 && this.waveTimer < waveDef.duration) {
            this.fillSpawnQueue(waveDef);
        }

        // Spawn enemies on interval
        const nightFactor = (this.app as any).__nightFactor || 0;
        const spawnMultiplier = 1 + nightFactor * (NIGHT_SPAWN_MULTIPLIER - 1);
        const adjustedInterval = waveDef.spawnInterval / spawnMultiplier;

        this.spawnTimer += dt;
        if (this.spawnTimer >= adjustedInterval && this.spawnQueue.length > 0) {
            this.spawnTimer = 0;
            this.spawnOneEnemy();
        }

        // Check wave completion
        if (this.waveTimer >= waveDef.duration) {
            this.waveTimer = 0;
            this.waveIndex++;
            this.spawnQueue = [];
            this.app.fire('wave:complete', this.waveIndex);
        }
    }

    private fillSpawnQueue(waveDef: WaveDef): void {
        for (const group of waveDef.enemies) {
            const def = this.enemyDefMap.get(group.enemyId);
            if (!def) continue;
            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push(def);
            }
        }

        // Shuffle
        for (let i = this.spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
        }
    }

    private spawnOneEnemy(): void {
        const def = this.spawnQueue.pop();
        if (!def) return;

        const player = this.app.root.findByName('player');
        const playerPos = player ? player.getPosition() : new pc.Vec3(0, 0, 0);

        // Spawn at random position around player, outside camera view
        const angle = Math.random() * Math.PI * 2;
        const distance = ENEMY_SPAWN_DISTANCE + Math.random() * 5;
        let x = playerPos.x + Math.cos(angle) * distance;
        let z = playerPos.z + Math.sin(angle) * distance;

        // Clamp to arena
        x = Math.max(-ARENA_HALF + 2, Math.min(ARENA_HALF - 2, x));
        z = Math.max(-ARENA_HALF + 2, Math.min(ARENA_HALF - 2, z));

        const spawnPos = new pc.Vec3(x, 0, z);

        // Apply night speed bonus
        const nightFactor = (this.app as any).__nightFactor || 0;
        const nightSpeedBonus = 1 + nightFactor * 0.2;
        const modifiedDef = { ...def, speed: def.speed * nightSpeedBonus };

        createEnemy(this.app, modifiedDef, spawnPos);
        this.totalEnemiesAlive++;
    }

    reset(): void {
        this.waveIndex = 0;
        this.spawnTimer = 0;
        this.waveTimer = 0;
        this.spawnQueue = [];
        this.totalEnemiesAlive = 0;
    }
}
