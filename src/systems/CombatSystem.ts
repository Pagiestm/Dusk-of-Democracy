import * as pc from 'playcanvas';
import { WeaponDef } from '../types';
import { createProjectile } from '../entities/ProjectileFactory';

interface ActiveWeapon {
    def: WeaponDef;
    cooldownTimer: number;
}

export class CombatSystem {
    private app: pc.Application;
    private weapons: ActiveWeapon[] = [];
    private playerEntity: pc.Entity | null = null;

    // Remote player weapons (host only, keyed by userId)
    private remoteWeapons: Map<number, ActiveWeapon[]> = new Map();

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
    addRemoteWeapon(userId: number, def: WeaponDef): void {
        if (!this.remoteWeapons.has(userId)) {
            this.remoteWeapons.set(userId, []);
        }
        this.remoteWeapons.get(userId)!.push({ def, cooldownTimer: 0 });
    }

    update(dt: number, cooldownMultiplier: number, damageMultiplier: number, extraProjectiles: number): void {
        if (!this.playerEntity) return;

        const game = (this.app as any).__game;
        const input = game?.inputManager?.getState();
        if (!input) return;

        // Local player auto-fire
        for (const weapon of this.weapons) {
            weapon.cooldownTimer -= dt;
            if (weapon.cooldownTimer <= 0) {
                weapon.cooldownTimer = weapon.def.cooldown * cooldownMultiplier;
                this.fireWeaponFromEntity(this.playerEntity, weapon.def, input.aimDirection.x, input.aimDirection.y, damageMultiplier, extraProjectiles);
            }
        }

        // Update cooldowns for remote weapons
        for (const weapons of this.remoteWeapons.values()) {
            for (const w of weapons) {
                w.cooldownTimer -= dt;
            }
        }
    }

    /** Host: fire weapons for a remote player when they press fire */
    fireForRemotePlayer(entity: pc.Entity, aimX: number, aimZ: number, damageMultiplier: number, extraProjectiles: number): void {
        // Find the remote player's userId from entity name
        const match = entity.name.match(/remote_player_(\d+)/);
        if (!match) return;
        const userId = parseInt(match[1]);

        const weapons = this.remoteWeapons.get(userId);
        if (!weapons) return;

        for (const weapon of weapons) {
            if (weapon.cooldownTimer <= 0) {
                weapon.cooldownTimer = weapon.def.cooldown;
                this.fireWeaponFromEntity(entity, weapon.def, aimX, aimZ, damageMultiplier, extraProjectiles);
            }
        }
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

            createProjectile(this.app, pos, new pc.Vec3(dirX, 0, dirZ), def.projectileSpeed, def.projectileLifetime, damage);
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

            createProjectile(this.app, pos, new pc.Vec3(dirX, 0, dirZ), def.projectileSpeed, def.projectileLifetime, damage);
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
