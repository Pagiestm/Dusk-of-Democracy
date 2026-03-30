import * as pc from 'playcanvas';
import { ENEMY_CONTACT_COOLDOWN, NIGHT_SPEED_MULTIPLIER, GameState } from '../constants';

export class EnemyAI extends pc.Script {
    static scriptName = 'enemyAI';

    speed: number = 3;
    contactDamage: number = 10;
    private contactTimer: number = 0;
    private dir: pc.Vec3 = new pc.Vec3();

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (game && game.state !== GameState.PLAYING) return;

        // Find nearest ALIVE player (skip dead/disabled players)
        const players = this.app.root.findByTag('player') as pc.Entity[];
        if (players.length === 0) return;

        const myPos = this.entity.getPosition();
        let nearest: pc.Entity | null = null;
        let nearestDist = Infinity;

        for (const p of players) {
            if (!p.enabled) continue; // skip dead players
            const pp = p.getPosition();
            const dx = pp.x - myPos.x;
            const dz = pp.z - myPos.z;
            const d = dx * dx + dz * dz;
            if (d < nearestDist) {
                nearestDist = d;
                nearest = p;
            }
        }

        if (!nearest) return;
        const playerPos = nearest.getPosition();

        // Vitesse boostée la nuit
        const nightFactor: number = (this.app as any).__nightFactor ?? 0;
        const effectiveSpeed = this.speed * (1 + nightFactor * (NIGHT_SPEED_MULTIPLIER - 1));

        // Move toward nearest player
        this.dir.sub2(playerPos, myPos);
        this.dir.y = 0;
        const dist = this.dir.length();

        if (dist > 0.5) {
            this.dir.normalize();
            this.entity.setPosition(
                myPos.x + this.dir.x * effectiveSpeed * dt,
                myPos.y,
                myPos.z + this.dir.z * effectiveSpeed * dt
            );
        }

        // Face nearest player
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

