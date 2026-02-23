// === Arena ===
export const ARENA_SIZE = 80;
export const ARENA_HALF = ARENA_SIZE / 2;

// === Player ===
export const PLAYER_BASE_SPEED = 8;
export const PLAYER_BASE_HP = 100;
export const PLAYER_MAGNET_RADIUS = 3;

// === Camera ===
export const CAMERA_HEIGHT = 20;
export const CAMERA_ANGLE = -60; // degrees from horizontal
export const CAMERA_FOLLOW_SPEED = 5;

// === Combat ===
export const PROJECTILE_BASE_SPEED = 20;
export const PROJECTILE_BASE_LIFETIME = 2.0;
export const PROJECTILE_SIZE = 0.15;

// === Enemies ===
export const ENEMY_SPAWN_DISTANCE = 25; // spawn outside camera view
export const ENEMY_BASE_SPEED = 3;
export const ENEMY_BASE_HP = 20;
export const ENEMY_CONTACT_DAMAGE = 10;
export const ENEMY_CONTACT_COOLDOWN = 0.5;

// === XP ===
export const XP_BASE_PER_LEVEL = 100; // level N needs N * XP_BASE_PER_LEVEL
export const XP_PICKUP_MAGNET_SPEED = 15;
export const XP_PICKUP_SIZE = 0.3;

// === Day/Night ===
export const DAY_CYCLE_DURATION = 300; // seconds for full cycle (5 min)
export const NIGHT_SPAWN_MULTIPLIER = 1.5;
export const NIGHT_SPEED_MULTIPLIER = 1.2;

// === Collision Layers ===
export enum CollisionLayer {
    PLAYER = 0,
    ENEMY = 1,
    PLAYER_PROJECTILE = 2,
    PICKUP = 3,
}

// === Game States ===
export enum GameState {
    LOADING = 'loading',
    MAIN_MENU = 'main_menu',
    CHARACTER_SELECT = 'character_select',
    WEAPON_SELECT = 'weapon_select',
    PLAYING = 'playing',
    PAUSED = 'paused',
    LEVEL_UP = 'level_up',
    WAVE_END = 'wave_end',
    GAME_OVER = 'game_over',
}

// === Collision matrix: which layers collide ===
export const COLLISION_PAIRS: [CollisionLayer, CollisionLayer][] = [
    [CollisionLayer.PLAYER_PROJECTILE, CollisionLayer.ENEMY],
    [CollisionLayer.ENEMY, CollisionLayer.PLAYER],
    [CollisionLayer.PICKUP, CollisionLayer.PLAYER],
];
