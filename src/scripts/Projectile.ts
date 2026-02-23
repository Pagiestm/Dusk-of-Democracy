import * as pc from 'playcanvas';
import { GameState } from '../constants';

export class Projectile extends pc.Script {
    static scriptName = 'projectile';

    speed: number = 20;
    lifetime: number = 2.0;
    damage: number = 10;
    direction: pc.Vec3 = new pc.Vec3(0, 0, -1);

    private age: number = 0;

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (game && game.state !== GameState.PLAYING) return;

        this.age += dt;

        if (this.age >= this.lifetime) {
            this.entity.destroy();
            return;
        }

        // Move in direction
        const pos = this.entity.getPosition();
        this.entity.setPosition(
            pos.x + this.direction.x * this.speed * dt,
            pos.y,
            pos.z + this.direction.z * this.speed * dt
        );
    }
}
