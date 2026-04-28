import * as pc from 'playcanvas';
import { GameState } from '../constants';

/**
 * Stationary wall that damages enemies passing through it.
 * Each enemy can only be damaged once.
 */
export class Wall extends pc.Script {
    static scriptName = 'wall';

    lifetime: number = 2.5;
    damage: number = 16;
    halfWidth: number = 3;   // along local X
    halfDepth: number = 0.5; // along local Z (thickness)

    private age: number = 0;
    private hitEnemies: Set<pc.Entity> = new Set();

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (game && game.state !== GameState.PLAYING) return;

        this.age += dt;
        if (this.age >= this.lifetime) {
            this.entity.destroy();
            return;
        }

        // Damage enemies inside the wall's oriented bounding box (host only)
        if (game && game.isClient) return;

        const wallPos = this.entity.getPosition();
        const wallRot = this.entity.getRotation();
        const inv = wallRot.clone().invert();

        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        for (const e of enemies) {
            if (!e.enabled || this.hitEnemies.has(e)) continue;
            const ep = e.getPosition();
            const local = new pc.Vec3(ep.x - wallPos.x, 0, ep.z - wallPos.z);
            inv.transformVector(local, local);
            if (Math.abs(local.x) <= this.halfWidth && Math.abs(local.z) <= this.halfDepth) {
                const health = e.script?.get('health') as any;
                if (health) {
                    const ownerId = (this.entity as any).__ownerId;
                    if (ownerId) (e as any).__lastAttacker = ownerId;
                    health.takeDamage(this.damage, false);
                }
                this.hitEnemies.add(e);
            }
        }
    }
}
