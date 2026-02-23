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

    update(dt: number, cooldownMultiplier: number, damageMultiplier: number, extraProjectiles: number): void {
        if (!this.playerEntity) return;

        const game = (this.app as any).__game;
        const input = game?.inputManager?.getState();
        if (!input) return;

        for (const weapon of this.weapons) {
            weapon.cooldownTimer -= dt;

            if (weapon.cooldownTimer <= 0) {
                weapon.cooldownTimer = weapon.def.cooldown * cooldownMultiplier;
                this.fireWeapon(weapon.def, input.aimDirection, damageMultiplier, extraProjectiles);
            }
        }
    }

    private fireWeapon(
        def: WeaponDef,
        aimDir: pc.Vec2,
        damageMultiplier: number,
        extraProjectiles: number
    ): void {
        if (!this.playerEntity) return;

        const pos = this.playerEntity.getPosition();
        const spawnPos = new pc.Vec3(pos.x, 0.5, pos.z);
        const damage = def.damage * damageMultiplier;

        // Default aim if no direction
        let aimX = aimDir.x;
        let aimZ = aimDir.y;
        if (aimX === 0 && aimZ === 0) {
            // Aim based on player forward
            const fwd = this.playerEntity.forward;
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
                // TODO: orbiting projectiles
                this.fireSingle(spawnPos, aimX, aimZ, def, damage, extraProjectiles);
                break;
        }
    }

    private fireSingle(
        pos: pc.Vec3,
        aimX: number,
        aimZ: number,
        def: WeaponDef,
        damage: number,
        extraProjectiles: number
    ): void {
        const totalProjectiles = 1 + extraProjectiles;
        const spreadPerExtra = 5; // degrees between extra projectiles

        for (let i = 0; i < totalProjectiles; i++) {
            const angleOffset = (i - (totalProjectiles - 1) / 2) * spreadPerExtra * (Math.PI / 180);
            const cos = Math.cos(angleOffset);
            const sin = Math.sin(angleOffset);
            const dirX = aimX * cos - aimZ * sin;
            const dirZ = aimX * sin + aimZ * cos;

            createProjectile(
                this.app,
                pos,
                new pc.Vec3(dirX, 0, dirZ),
                def.projectileSpeed,
                def.projectileLifetime,
                damage
            );
        }
    }

    private fireSpread(
        pos: pc.Vec3,
        aimX: number,
        aimZ: number,
        def: WeaponDef,
        damage: number,
        extraProjectiles: number
    ): void {
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

            createProjectile(
                this.app,
                pos,
                new pc.Vec3(dirX, 0, dirZ),
                def.projectileSpeed,
                def.projectileLifetime,
                damage
            );
        }
    }

    private fireArea(pos: pc.Vec3, def: WeaponDef, damage: number): void {
        // Create a temporary area effect
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
        for (const mi of area.render!.meshInstances) {
            mi.material = mat;
        }

        area.tags.add('area_effect');
        this.app.root.addChild(area);

        // Damage all enemies in radius
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const enemy of enemies) {
            const enemyPos = enemy.getPosition();
            const dx = enemyPos.x - pos.x;
            const dz = enemyPos.z - pos.z;
            if (dx * dx + dz * dz < radius * radius) {
                const health = (enemy as pc.Entity).script?.get('health') as any;
                if (health) {
                    health.takeDamage(damage);
                }
            }
        }

        // Destroy effect after brief delay
        setTimeout(() => {
            if (area.parent) area.destroy();
        }, 300);
    }

    clear(): void {
        this.weapons = [];
        this.playerEntity = null;
    }
}
