// Pure data types — no PlayCanvas dependency

export interface CharacterDef {
    id: string;
    name: string;
    description: string;
    hp: number;
    speed: number;
}

export interface WeaponDef {
    id: string;
    name: string;
    description: string;
    damage: number;
    cooldown: number;
    pattern: 'single' | 'spread' | 'orbit' | 'area';
    projectileSpeed: number;
    projectileLifetime: number;
    spreadCount?: number;
    spreadAngle?: number;
    areaRadius?: number;
}

export interface EnemyDef {
    id: string;
    name: string;
    hp: number;
    speed: number;
    damage: number;
    xpReward: number;
    scale: number;
}

export interface PlayerStats {
    maxHp: number;
    hp: number;
    speed: number;
    damage: number;
    cooldownMultiplier: number;
    magnetRadius: number;
    armor: number;
    maxArmor: number;
    projectileCount: number;
}

export interface PlayerInput {
    moveDir: { x: number; z: number };
    aimDir: { x: number; z: number };
    fire: boolean;
}

export interface PlayerSnapshot {
    id: string;
    x: number;
    z: number;
    angle: number;
    hp: number;
    maxHp: number;
    armor: number;
    maxArmor: number;
}

export interface EnemySnapshot {
    id: number;
    defId: string;
    x: number;
    z: number;
    hp: number;
}

export interface GameSnapshot {
    tick: number;
    gameTime: number;
    wave: number;
    timeOfDay: number;
    nightFactor: number;
    players: PlayerSnapshot[];
    enemies: EnemySnapshot[];
}

export interface GameEndStats {
    playerId: string;
    characterId: string;
    weaponId: string;
    kills: number;
    waveReached: number;
    timeSurvived: number;
    levelReached: number;
    goldEarned: number;
}
