import * as pc from 'playcanvas';
import { PLAYER_BASE_SPEED, ARENA_HALF } from '../constants';

export class PlayerController extends pc.Script {
    static scriptName = 'playerController';

    speed: number = PLAYER_BASE_SPEED;

    private moveDir: pc.Vec3 = new pc.Vec3();

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (!game) return;

        const input = game.inputManager.getState();

        // Movement
        this.moveDir.set(input.moveDirection.x, 0, input.moveDirection.y);

        if (this.moveDir.lengthSq() > 0) {
            const pos = this.entity.getPosition();
            const newX = pos.x + this.moveDir.x * this.speed * dt;
            const newZ = pos.z + this.moveDir.z * this.speed * dt;

            // Clamp to arena bounds
            const clampedX = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, newX));
            const clampedZ = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, newZ));

            this.entity.setPosition(clampedX, pos.y, clampedZ);
        }

        // Face aim direction
        if (input.aimDirection.lengthSq() > 0) {
            const angle = Math.atan2(input.aimDirection.x, input.aimDirection.y) * (180 / Math.PI);
            this.entity.setEulerAngles(0, angle, 0);
        }
    }

    setSpeed(speed: number): void {
        this.speed = speed;
    }
}
