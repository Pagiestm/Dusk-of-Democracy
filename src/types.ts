import * as pc from 'playcanvas';
import { CollisionLayer } from './constants';

// === Input ===
export interface InputState {
    moveDirection: pc.Vec2;
    aimDirection: pc.Vec2;
    aimWorldPos: pc.Vec3;
    fire: boolean;
    interact: boolean;
    pause: boolean;
}

// === Characters ===
export interface CharacterDef {
    id: string;
    name: string;
    description: string;
    hp: number;
    speed: number;
    startingWeaponId: string;
    color: pc.Color; // placeholder color until models are loaded
}

// === Weapons ===
export type WeaponPattern = 'single' | 'spread' | 'orbit' | 'area';

export interface WeaponDef {
    id: string;
    name: string;
    damage: number;
    cooldown: number;
    pattern: WeaponPattern;
    projectileSpeed: number;
    projectileLifetime: number;
    spreadCount?: number;
    spreadAngle?: number;
    areaRadius?: number;
}

// === Enemies ===
export interface EnemyDef {
    id: string;
    name: string;
    hp: number;
    speed: number;
    damage: number;
    xpReward: number;
    color: pc.Color; // placeholder color
    scale: number;
}

// === Waves ===
export interface WaveEnemyGroup {
    enemyId: string;
    count: number;
}

export interface WaveDef {
    wave: number;
    enemies: WaveEnemyGroup[];
    spawnInterval: number;
    duration: number;
}

// === Upgrades ===
export interface UpgradeDef {
    id: string;
    name: string;
    description: string;
    maxLevel: number;
    apply: (stats: PlayerStats) => void;
}

// === Player Runtime Stats ===
export interface PlayerStats {
    maxHp: number;
    hp: number;
    speed: number;
    damage: number;
    cooldownMultiplier: number;
    magnetRadius: number;
    armor: number;
    projectileCount: number;
}

// === Collision Entry ===
export interface CollisionEntry {
    entity: pc.Entity;
    radius: number;
    layer: CollisionLayer;
}
