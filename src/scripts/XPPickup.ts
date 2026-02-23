import * as pc from 'playcanvas';
import { XP_PICKUP_MAGNET_SPEED } from '../constants';

export class XPPickup extends pc.Script {
    static scriptName = 'xpPickup';

    xpValue: number = 10;
    private attracted: boolean = false;
    private bobOffset: number = 0;

    initialize(): void {
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt: number): void {
        const player = this.app.root.findByName('player');
        if (!player) return;

        const myPos = this.entity.getPosition();
        const playerPos = player.getPosition();
        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Get magnet radius from game
        const game = (this.app as any).__game;
        const magnetRadius = game?.playerStats?.magnetRadius ?? 3;

        if (dist < magnetRadius) {
            this.attracted = true;
        }

        if (this.attracted && dist > 0.3) {
            // Move toward player
            const speed = XP_PICKUP_MAGNET_SPEED;
            this.entity.setPosition(
                myPos.x + (dx / dist) * speed * dt,
                myPos.y,
                myPos.z + (dz / dist) * speed * dt
            );
        }

        // Bob up and down
        this.bobOffset += dt * 3;
        const baseY = 0.5;
        this.entity.setPosition(
            this.entity.getPosition().x,
            baseY + Math.sin(this.bobOffset) * 0.15,
            this.entity.getPosition().z
        );
    }
}
