import * as pc from 'playcanvas';
import { WeaponDef } from '../types';
import { createProjectile } from '../entities/ProjectileFactory';
import { AimSettings } from '../core/AimSettings';
import { getCachedModel } from '../core/AssetLoader';
import { Wall } from '../scripts/Wall';

interface ActiveWeapon {
    def: WeaponDef;
    cooldownTimer: number;
}

export class CombatSystem {
    private app: pc.Application;
    private weapons: ActiveWeapon[] = [];
    private playerEntity: pc.Entity | null = null;

    // Remote player weapons (host only, keyed by playerId / socket.id)
    private remoteWeapons: Map<string, ActiveWeapon[]> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
    }

    setPlayer(entity: pc.Entity): void {
        this.playerEntity = entity;
    }

    addWeapon(def: WeaponDef): void {
        this.weapons.push({ def, cooldownTimer: 0 });
    }

    removeWeapon(weaponId: string): void {
        this.weapons = this.weapons.filter(w => w.def.id !== weaponId);
    }

    hasWeapon(weaponId: string): boolean {
        return this.weapons.some(w => w.def.id === weaponId);
    }

    getWeapons(): ActiveWeapon[] {
        return this.weapons;
    }

    /** Host: register a weapon for a remote player */
    addRemoteWeapon(playerId: string, def: WeaponDef): void {
        if (!this.remoteWeapons.has(playerId)) {
            this.remoteWeapons.set(playerId, []);
        }
        this.remoteWeapons.get(playerId)!.push({ def, cooldownTimer: 0 });
    }

    update(dt: number, cooldownMultiplier: number, damageMultiplier: number, extraProjectiles: number): void {
        if (!this.playerEntity) return;

        // Local player auto-fire — only if alive (entity enabled)
        if (this.playerEntity.enabled) {
            const game = (this.app as any).__game;
            const input = game?.inputManager?.getState();
            if (input) {
                // Resolve aim: auto-aim toward nearest enemy if enabled, else manual input
                let aimX = input.aimDirection.x;
                let aimZ = input.aimDirection.y;
                if (AimSettings.isAutoAimEnabled()) {
                    const auto = this.computeAutoAim(this.playerEntity);
                    if (auto) { aimX = auto.x; aimZ = auto.z; }
                }

                const finalDamageMult = damageMultiplier * AimSettings.getDamageMultiplier();
                this.currentOwnerId = game?.network?.myId || null;
                for (const weapon of this.weapons) {
                    weapon.cooldownTimer -= dt;
                    if (weapon.cooldownTimer <= 0) {
                        weapon.cooldownTimer = weapon.def.cooldown * cooldownMultiplier;
                        this.fireWeaponFromEntity(this.playerEntity, weapon.def, aimX, aimZ, finalDamageMult, extraProjectiles);
                    }
                }
                this.currentOwnerId = null;
            }
        }

        // Update cooldowns for remote weapons (always, so they don't burst-fire on respawn)
        for (const weapons of this.remoteWeapons.values()) {
            for (const w of weapons) {
                w.cooldownTimer -= dt;
            }
        }
    }

    /** Host: fire weapons for a remote player when they press fire */
    fireForRemotePlayer(entity: pc.Entity, aimX: number, aimZ: number, damageMultiplier: number, extraProjectiles: number): void {
        const playerId = (entity as any).__playerId as string | undefined;
        if (!playerId) return;

        const weapons = this.remoteWeapons.get(playerId);
        if (!weapons) return;

        this.currentOwnerId = playerId;
        for (const weapon of weapons) {
            if (weapon.cooldownTimer <= 0) {
                weapon.cooldownTimer = weapon.def.cooldown;
                this.fireWeaponFromEntity(entity, weapon.def, aimX, aimZ, damageMultiplier, extraProjectiles);
            }
        }
        this.currentOwnerId = null;
    }

    /** Current owner ID to tag on created projectiles */
    private currentOwnerId: string | null = null;

    /** Compute aim direction toward nearest alive enemy. Returns null if no enemy in range. */
    private computeAutoAim(player: pc.Entity): { x: number; z: number } | null {
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        if (enemies.length === 0) return null;

        const myPos = player.getPosition();
        let nearest: pc.Entity | null = null;
        let nearestDistSq = Infinity;

        for (const e of enemies) {
            if (!e.enabled) continue;
            const ep = e.getPosition();
            const dx = ep.x - myPos.x;
            const dz = ep.z - myPos.z;
            const d = dx * dx + dz * dz;
            if (d < nearestDistSq) {
                nearestDistSq = d;
                nearest = e;
            }
        }

        if (!nearest) return null;

        const ep = nearest.getPosition();
        const dx = ep.x - myPos.x;
        const dz = ep.z - myPos.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) return null;
        return { x: dx / len, z: dz / len };
    }

    private fireWeaponFromEntity(
        entity: pc.Entity,
        def: WeaponDef,
        aimX: number,
        aimZ: number,
        damageMultiplier: number,
        extraProjectiles: number
    ): void {
        const pos = entity.getPosition();
        const spawnPos = new pc.Vec3(pos.x, 0.5, pos.z);
        const damage = def.damage * damageMultiplier;

        if (aimX === 0 && aimZ === 0) {
            const fwd = entity.forward;
            aimX = -fwd.x;
            aimZ = -fwd.z;
        }

        switch (def.pattern) {
            case 'single':
                this.fireSingle(spawnPos, aimX, aimZ, def, damage, extraProjectiles);
                break;
            case 'spread':
                this.fireSpread(spawnPos, aimX, aimZ, def, damage, extraProjectiles);
                break;
            case 'area':
                this.fireArea(spawnPos, def, damage);
                break;
            case 'orbit':
                this.fireSingle(spawnPos, aimX, aimZ, def, damage, extraProjectiles);
                break;
            case 'wall':
                this.fireWall(spawnPos, aimX, aimZ, def, damage);
                break;
        }
    }

    private fireWall(pos: pc.Vec3, aimX: number, aimZ: number, def: WeaponDef, damage: number): void {
        const len = Math.sqrt(aimX * aimX + aimZ * aimZ);
        if (len < 0.01) return;
        const dirX = aimX / len;
        const dirZ = aimZ / len;

        // Place the wall in front of the player
        const distAhead = 3;
        const wallX = pos.x + dirX * distAhead;
        const wallZ = pos.z + dirZ * distAhead;

        // Wall width covers the spread arc at the spawn distance
        const arcRad = ((def.spreadAngle || 40) * Math.PI) / 180;
        const halfWidth = Math.max(5, distAhead * Math.tan(arcRad / 2) + 4);

        const wall = new pc.Entity('wall');
        wall.setPosition(wallX, 0, wallZ);
        // Yaw so the wall's local X axis spans across the aim direction
        const yaw = Math.atan2(dirX, dirZ) * (180 / Math.PI);
        wall.setLocalEulerAngles(0, yaw + 90, 0);

        // Visual: instantiated wall GLB scaled to halfWidth
        const wallAsset = getCachedModel('assets/wall/wall.glb');
        if (wallAsset) {
            const container = wallAsset.resource as any;
            const visual = container.instantiateRenderEntity() as pc.Entity;
            // The wall model spans ~3.3 along X. Scale so it covers `halfWidth*2`
            const scaleX = (halfWidth * 2) / 3.3;
            visual.setLocalScale(scaleX, 1.5, 1);
            wall.addChild(visual);
        } else {
            // Fallback box
            wall.addComponent('render', { type: 'box' });
            wall.setLocalScale(halfWidth * 2, 1.5, 1);
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(0.45, 0.30, 0.15);
            mat.update();
            for (const mi of wall.render!.meshInstances) mi.material = mat;
        }

        wall.addComponent('script');
        const wallScript = wall.script!.create(Wall) as unknown as Wall;
        wallScript.lifetime = def.projectileLifetime;
        wallScript.damage = damage;
        wallScript.halfWidth = halfWidth;
        wallScript.halfDepth = 0.5;

        if (this.currentOwnerId) (wall as any).__ownerId = this.currentOwnerId;

        wall.tags.add('wall_effect');
        this.app.root.addChild(wall);
    }

    private tagProjectile(proj: pc.Entity): void {
        if (this.currentOwnerId) {
            (proj as any).__ownerId = this.currentOwnerId;
        }
    }

    private fireSingle(pos: pc.Vec3, aimX: number, aimZ: number, def: WeaponDef, damage: number, extraProjectiles: number): void {
        const totalProjectiles = 1 + extraProjectiles;
        const spreadPerExtra = 5;

        for (let i = 0; i < totalProjectiles; i++) {
            const angleOffset = (i - (totalProjectiles - 1) / 2) * spreadPerExtra * (Math.PI / 180);
            const cos = Math.cos(angleOffset);
            const sin = Math.sin(angleOffset);
            const dirX = aimX * cos - aimZ * sin;
            const dirZ = aimX * sin + aimZ * cos;

            const proj = createProjectile(this.app, pos, new pc.Vec3(dirX, 0, dirZ), def.projectileSpeed, def.projectileLifetime, damage);
            this.tagProjectile(proj);
        }
    }

    private fireSpread(pos: pc.Vec3, aimX: number, aimZ: number, def: WeaponDef, damage: number, extraProjectiles: number): void {
        const count = (def.spreadCount || 3) + extraProjectiles;
        const totalAngle = (def.spreadAngle || 30) * (Math.PI / 180);
        const step = count > 1 ? totalAngle / (count - 1) : 0;
        const startAngle = -totalAngle / 2;

        for (let i = 0; i < count; i++) {
            const angle = startAngle + step * i;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const dirX = aimX * cos - aimZ * sin;
            const dirZ = aimX * sin + aimZ * cos;

            const proj = createProjectile(this.app, pos, new pc.Vec3(dirX, 0, dirZ), def.projectileSpeed, def.projectileLifetime, damage);
            this.tagProjectile(proj);
        }
    }

    private fireArea(pos: pc.Vec3, def: WeaponDef, damage: number): void {
        const area = new pc.Entity('area_effect');
        area.addComponent('render', { type: 'cylinder' });

        const radius = def.areaRadius || 4;
        area.setLocalScale(radius * 2, 0.2, radius * 2);
        area.setPosition(pos.x, 0.1, pos.z);

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 0.5, 0.2);
        mat.emissive = new pc.Color(1, 0.3, 0.1);
        mat.emissiveIntensity = 3;
        mat.opacity = 0.5;
        mat.blendType = pc.BLEND_ADDITIVE;
        mat.update();
        for (const mi of area.render!.meshInstances) mi.material = mat;

        area.tags.add('area_effect');
        this.app.root.addChild(area);

        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const enemy of enemies) {
            const enemyPos = enemy.getPosition();
            const dx = enemyPos.x - pos.x;
            const dz = enemyPos.z - pos.z;
            if (dx * dx + dz * dz < radius * radius) {
                const health = (enemy as pc.Entity).script?.get('health') as any;
                if (health) health.takeDamage(damage);
            }
        }

        setTimeout(() => { if (area.parent) area.destroy(); }, 300);
    }

    clear(): void {
        this.weapons = [];
        this.remoteWeapons.clear();
        this.playerEntity = null;
    }
}
