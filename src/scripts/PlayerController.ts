import * as pc from 'playcanvas';
import { PLAYER_BASE_SPEED, ARENA_HALF, GameState } from '../constants';
import { AimSettings } from '../core/AimSettings';

export class PlayerController extends pc.Script {
    static scriptName = 'playerController';

    speed: number = PLAYER_BASE_SPEED;

    private moveDir: pc.Vec3 = new pc.Vec3();
    private wasMoving: boolean = false;

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (!game || game.state !== GameState.PLAYING) return;

        const input = game.inputManager.getState();

        // Movement
        this.moveDir.set(input.moveDirection.x, 0, input.moveDirection.y);

        const isMoving = this.moveDir.lengthSq() > 0;

        if (isMoving) {
            const pos = this.entity.getPosition();
            const dx = this.moveDir.x * this.speed * dt;
            const dz = this.moveDir.z * this.speed * dt;

            let finalX = pos.x + dx;
            let finalZ = pos.z + dz;

            // Raycast-based collision with physics
            const rigidbody = this.app.systems.rigidbody;
            if (rigidbody) {
                const radius = 0.5;
                const origin = new pc.Vec3(pos.x, pos.y + 0.5, pos.z);

                // Check X movement
                if (dx !== 0) {
                    const targetX = new pc.Vec3(pos.x + dx + Math.sign(dx) * radius, pos.y + 0.5, pos.z);
                    const hitX = rigidbody.raycastFirst(origin, targetX);
                    if (hitX) finalX = pos.x;
                }

                // Check Z movement
                if (dz !== 0) {
                    const targetZ = new pc.Vec3(pos.x, pos.y + 0.5, pos.z + dz + Math.sign(dz) * radius);
                    const hitZ = rigidbody.raycastFirst(origin, targetZ);
                    if (hitZ) finalZ = pos.z;
                }
            }

            // Clamp to arena bounds
            finalX = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, finalX));
            finalZ = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, finalZ));

            this.entity.setPosition(finalX, pos.y, finalZ);
        }

        // Face aim direction (auto-aim toward nearest enemy if enabled)
        let aimX = input.aimDirection.x;
        let aimZ = input.aimDirection.y;
        if (AimSettings.isAutoAimEnabled()) {
            const auto = this.findNearestEnemyDir();
            if (auto) { aimX = auto.x; aimZ = auto.z; }
        }
        if (aimX !== 0 || aimZ !== 0) {
            const angle = Math.atan2(aimX, aimZ) * (180 / Math.PI);
            this.entity.setEulerAngles(0, angle, 0);
        }

        // Switch animation state via the pre-built state graph
        if (isMoving !== this.wasMoving) {
            const modelEntity = (this.entity as any).__modelEntity as pc.Entity | undefined;
            if (modelEntity && (this.entity as any).__hasAnims) {
                this.wasMoving = isMoving;
                modelEntity.anim?.baseLayer?.transition(isMoving ? 'run' : 'idle', 0.15);
            }
        }

    }

    setSpeed(speed: number): void {
        this.speed = speed;
    }

    private findNearestEnemyDir(): { x: number; z: number } | null {
        const enemies = this.app.root.findByTag('enemy') as pc.Entity[];
        if (enemies.length === 0) return null;
        const myPos = this.entity.getPosition();
        let nearest: pc.Entity | null = null;
        let nearestDistSq = Infinity;
        for (const e of enemies) {
            if (!e.enabled) continue;
            const ep = e.getPosition();
            const dx = ep.x - myPos.x;
            const dz = ep.z - myPos.z;
            const d = dx * dx + dz * dz;
            if (d < nearestDistSq) { nearestDistSq = d; nearest = e; }
        }
        if (!nearest) return null;
        const ep = nearest.getPosition();
        const dx = ep.x - myPos.x;
        const dz = ep.z - myPos.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) return null;
        return { x: dx / len, z: dz / len };
    }
}
