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
    private cycle: number = 0; // nombre de fois qu'on a bouclé les 6 waves

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
            this.waveIndex = 0;
            this.cycle++;
        }

        const waveDef = WAVES[this.waveIndex];
        this.currentWave = this.cycle * WAVES.length + waveDef.wave;

        // Advance wave timer
        this.waveTimer += dt;

        // Fill spawn queue if empty
        if (this.spawnQueue.length === 0 && this.waveTimer < waveDef.duration) {
            this.fillSpawnQueue(waveDef);
        }

        // Spawn enemies on interval
        const nightFactor = (this.app as any).__nightFactor || 0;
        const spawnMultiplier = 1 + nightFactor * (NIGHT_SPAWN_MULTIPLIER - 1);
        const cycleIntervalMult = this.getSpawnIntervalMultiplier();
        const adjustedInterval = (waveDef.spawnInterval * cycleIntervalMult) / spawnMultiplier;

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

    /** Multiplicateur de quantite d'ennemis selon le cycle */
    private getCountMultiplier(): number {
        return 1 + this.cycle * 0.5; // +50% d'ennemis par cycle
    }

    /** Multiplicateur de vitesse d'intervalle selon le cycle */
    private getSpawnIntervalMultiplier(): number {
        return Math.max(0.3, 1 - this.cycle * 0.1); // -10% par cycle, min 30%
    }

    private fillSpawnQueue(waveDef: WaveDef): void {
        const countMult = this.getCountMultiplier();
        for (const group of waveDef.enemies) {
            const def = this.enemyDefMap.get(group.enemyId);
            if (!def) continue;
            const scaledCount = Math.ceil(group.count * countMult);
            for (let i = 0; i < scaledCount; i++) {
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

        // Apply night speed bonus + cycle scaling
        const nightFactor = (this.app as any).__nightFactor || 0;
        const nightSpeedBonus = 1 + nightFactor * 0.2;
        const cycleHpMult = 1 + this.cycle * 0.3;    // +30% HP par cycle
        const cycleDmgMult = 1 + this.cycle * 0.2;   // +20% degats par cycle
        const cycleSpeedMult = 1 + this.cycle * 0.05; // +5% vitesse par cycle
        const modifiedDef = {
            ...def,
            speed: def.speed * nightSpeedBonus * cycleSpeedMult,
            hp: Math.ceil(def.hp * cycleHpMult),
            damage: Math.ceil(def.damage * cycleDmgMult),
        };

        createEnemy(this.app, modifiedDef, spawnPos);
        this.totalEnemiesAlive++;
    }

    reset(): void {
        this.waveIndex = 0;
        this.cycle = 0;
        this.spawnTimer = 0;
        this.waveTimer = 0;
        this.spawnQueue = [];
        this.totalEnemiesAlive = 0;
    }
}
