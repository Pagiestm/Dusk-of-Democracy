import * as pc from 'playcanvas';
import { ENEMIES } from '../data/enemies';
import { createEnemy } from '../entities/EnemyFactory';
import { ENEMY_SPAWN_DISTANCE, ARENA_HALF, NIGHT_SPAWN_MULTIPLIER } from '../constants';
import { EnemyDef } from '../types';

/** Duration in seconds for wave N (starts 25 s, +5 s/wave, capped at 180 s) */
function waveDuration(wave: number): number {
    return Math.min(25 + (wave - 1) * 5, 180);
}

/** Base spawn interval for wave N (starts 1.6 s, floors at 0.18 s) */
function waveSpawnInterval(wave: number): number {
    return Math.max(0.18, 1.6 * Math.pow(0.92, wave - 1));
}

/** Total enemy pool size for wave N (starts 12, +8/wave) */
function waveEnemyCount(wave: number): number {
    return 12 + (wave - 1) * 8;
}

/**
 * Weighted enemy roster for wave N.
 *   wave 1+ : basic
 *   wave 2+ : fast
 *   wave 3+ : swarm
 *   wave 5+ : tank
 */
function waveRoster(wave: number): { id: string; weight: number }[] {
    const roster: { id: string; weight: number }[] = [
        { id: 'basic', weight: Math.max(1, 6 - Math.floor(wave / 3)) },
    ];
    if (wave >= 2) roster.push({ id: 'fast',  weight: 2 + Math.floor(wave / 4) });
    if (wave >= 3) roster.push({ id: 'swarm', weight: 3 + Math.floor(wave / 3) });
    if (wave >= 5) roster.push({ id: 'tank',  weight: 1 + Math.floor(wave / 6) });
    return roster;
}

/** Pick a random enemy id from a weighted roster */
function pickFromRoster(roster: { id: string; weight: number }[]): string {
    const total = roster.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of roster) {
        roll -= r.weight;
        if (roll <= 0) return r.id;
    }
    return roster[roster.length - 1].id;
}

export class WaveSystem {
    private app: pc.Application;
    private spawnTimer: number = 0;
    private waveTimer: number = 0;
    private spawnQueue: EnemyDef[] = [];
    private enemyDefMap: Map<string, EnemyDef>;

    currentWave: number = 1;
    totalEnemiesAlive: number = 0;

    constructor(app: pc.Application) {
        this.app = app;

        this.enemyDefMap = new Map();
        for (const def of ENEMIES) {
            this.enemyDefMap.set(def.id, def);
        }

        this.app.on('enemy:died', () => {
            this.totalEnemiesAlive = Math.max(0, this.totalEnemiesAlive - 1);
        });
    }

    update(dt: number): void {
        const wave     = this.currentWave;
        const duration = waveDuration(wave);
        const interval = waveSpawnInterval(wave);

        this.waveTimer += dt;

        // Fill spawn queue once at the start of the wave
        if (this.spawnQueue.length === 0 && this.waveTimer < duration) {
            this.fillSpawnQueue(wave);
        }

        // Night factor accelerates spawning
        const nightFactor      = (this.app as any).__nightFactor ?? 0;
        const nightMult        = 1 + nightFactor * (NIGHT_SPAWN_MULTIPLIER - 1);
        const adjustedInterval = interval / nightMult;

        this.spawnTimer += dt;
        if (this.spawnTimer >= adjustedInterval && this.spawnQueue.length > 0) {
            this.spawnTimer = 0;
            this.spawnOneEnemy(wave);
        }

        // Wave complete
        if (this.waveTimer >= duration) {
            this.waveTimer  = 0;
            this.spawnQueue = [];
            this.app.fire('wave:complete', wave);
            this.currentWave++;
        }
    }

    private fillSpawnQueue(wave: number): void {
        const total  = waveEnemyCount(wave);
        const roster = waveRoster(wave);

        this.spawnQueue = [];
        for (let i = 0; i < total; i++) {
            const id  = pickFromRoster(roster);
            const def = this.enemyDefMap.get(id);
            if (def) this.spawnQueue.push(def);
        }

        // Fisher-Yates shuffle
        for (let i = this.spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
        }
    }

    private spawnOneEnemy(wave: number): void {
        const def = this.spawnQueue.pop();
        if (!def) return;

        const player    = this.app.root.findByName('player');
        const playerPos = player ? player.getPosition() : new pc.Vec3(0, 0, 0);

        const angle    = Math.random() * Math.PI * 2;
        const distance = ENEMY_SPAWN_DISTANCE + Math.random() * 5;
        let x = playerPos.x + Math.cos(angle) * distance;
        let z = playerPos.z + Math.sin(angle) * distance;

        x = Math.max(-ARENA_HALF + 2, Math.min(ARENA_HALF - 2, x));
        z = Math.max(-ARENA_HALF + 2, Math.min(ARENA_HALF - 2, z));

        // Scale stats with wave number
        const nightFactor = (this.app as any).__nightFactor ?? 0;
        const hpMult    = 1 + (wave - 1) * 0.20;                     // +20 % HP/wave
        const dmgMult   = 1 + (wave - 1) * 0.12;                     // +12 % damage/wave
        const speedMult = 1 + (wave - 1) * 0.04 + nightFactor * 0.20; // +4 %/wave + night bonus

        const modifiedDef: EnemyDef = {
            ...def,
            hp:     Math.ceil(def.hp     * hpMult),
            damage: Math.ceil(def.damage * dmgMult),
            speed:  def.speed * speedMult,
        };

        createEnemy(this.app, modifiedDef, new pc.Vec3(x, 0, z));
        this.totalEnemiesAlive++;
    }

    reset(): void {
        this.currentWave       = 1;
        this.spawnTimer        = 0;
        this.waveTimer         = 0;
        this.spawnQueue        = [];
        this.totalEnemiesAlive = 0;
    }
}
