import * as pc from 'playcanvas';
import { ENEMY_CONTACT_COOLDOWN } from '../constants';

export class EnemyAI extends pc.Script {
    static scriptName = 'enemyAI';

    speed: number = 3;
    contactDamage: number = 10;
    private contactTimer: number = 0;
    private dir: pc.Vec3 = new pc.Vec3();

    update(dt: number): void {
        const player = this.app.root.findByName('player');
        if (!player) return;

        // Move toward player
        const myPos = this.entity.getPosition();
        const playerPos = player.getPosition();

        this.dir.sub2(playerPos, myPos);
        this.dir.y = 0;
        const dist = this.dir.length();

        if (dist > 0.5) {
            this.dir.normalize();
            this.entity.setPosition(
                myPos.x + this.dir.x * this.speed * dt,
                myPos.y,
                myPos.z + this.dir.z * this.speed * dt
            );
        }

        // Face player
        if (dist > 0.1) {
            this.entity.lookAt(playerPos.x, myPos.y, playerPos.z);
        }

        // Contact damage cooldown
        if (this.contactTimer > 0) {
            this.contactTimer -= dt;
        }
    }

    canDealContactDamage(): boolean {
        return this.contactTimer <= 0;
    }

    resetContactCooldown(): void {
        this.contactTimer = ENEMY_CONTACT_COOLDOWN;
    }
}
