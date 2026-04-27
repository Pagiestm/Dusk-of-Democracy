import * as pc from "playcanvas";
import { CollisionLayer } from "./constants";

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
  startingWeaponId?: string; // kept for reference, player now picks their own
  color: pc.Color; // placeholder color until models are loaded
  modelPath?: string;
  modelScale?: number; // scale factor for the GLB model (default: 0.01 for Mixamo cm→m)
  modelYOffset?: number; // local Y offset applied to the model child entity (default: 0)
  texturePath?: string;
  animIdlePath?: string;
  animRunPath?: string;
  animDiePath?: string;
}

// === Weapons ===
export type WeaponPattern = "single" | "spread" | "orbit" | "area" | "wall";

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  pattern: WeaponPattern;
  projectileSpeed: number;
  projectileLifetime: number;
  spreadCount?: number;
  spreadAngle?: number;
  areaRadius?: number;
  /** Optional GLB model used for the projectile visual (replaces the default sphere). */
  projectileModelPath?: string;
  /** Optional uniform scale applied to the projectile model. */
  projectileModelScale?: number;
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
  modelPath?: string;
  modelScale?: number;
  modelYOffset?: number;
  modelYRotation?: number;
  animIdlePath?: string;
  animRunPath?: string;
  animAttackPath?: string;
  animDiePath?: string;
  // Ranged behavior — when set, the enemy fires projectiles at the player
  // and tries to keep its distance instead of meleeing.
  ranged?: {
    range: number;            // start firing within this distance
    cooldown: number;         // seconds between shots
    projectileSpeed: number;
    projectileLifetime: number;
    projectileDamage: number;
  };
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
  maxArmor: number;
  projectileCount: number;
}

// === Collision Entry ===
export interface CollisionEntry {
  entity: pc.Entity;
  radius: number;
  layer: CollisionLayer;
}
