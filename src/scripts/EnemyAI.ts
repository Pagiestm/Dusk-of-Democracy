import * as pc from "playcanvas";
import {
  ENEMY_CONTACT_COOLDOWN,
  NIGHT_SPEED_MULTIPLIER,
  GameState,
} from "../constants";

export class EnemyAI extends pc.Script {
  static scriptName = "enemyAI";

  speed: number = 3;
  contactDamage: number = 10;
  private contactTimer: number = 0;
  private dir: pc.Vec3 = new pc.Vec3();

  update(dt: number): void {
    const game = (this.app as any).__game;
    if (game && game.state !== GameState.PLAYING) return;

    const health: any = this.entity.script?.get("health");
    if (health && health.hp <= 0) return;

    // Find nearest ALIVE player (skip dead/disabled players)
    const players = this.app.root.findByTag("player") as pc.Entity[];
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
    const effectiveSpeed =
      this.speed * (1 + nightFactor * (NIGHT_SPEED_MULTIPLIER - 1));

    // Move toward nearest player
    this.dir.sub2(playerPos, myPos);
    this.dir.y = 0;
    const dist = this.dir.length();

    if (dist > 0.5) {
      this.dir.normalize();
      const dx = this.dir.x * effectiveSpeed * dt;
      const dz = this.dir.z * effectiveSpeed * dt;

      let finalX = myPos.x + dx;
      let finalZ = myPos.z + dz;

      // Raycast collision with buildings
      const rigidbody = this.app.systems.rigidbody;
      if (rigidbody) {
        const origin = new pc.Vec3(myPos.x, myPos.y + 0.3, myPos.z);
        if (dx !== 0) {
          const tX = new pc.Vec3(
            myPos.x + dx + Math.sign(dx) * 0.35,
            myPos.y + 0.3,
            myPos.z,
          );
          if (rigidbody.raycastFirst(origin, tX)) finalX = myPos.x;
        }
        if (dz !== 0) {
          const tZ = new pc.Vec3(
            myPos.x,
            myPos.y + 0.3,
            myPos.z + dz + Math.sign(dz) * 0.35,
          );
          if (rigidbody.raycastFirst(origin, tZ)) finalZ = myPos.z;
        }
      }

      this.entity.setPosition(finalX, myPos.y, finalZ);
    }

    // Face nearest player
    if (dist > 0.1) {
      this.entity.lookAt(playerPos.x, myPos.y, playerPos.z);
    }

    // Contact damage cooldown
    if (this.contactTimer > 0) {
      this.contactTimer -= dt;
    } else {
      // Revert attack anim to run if we're not attacking anymore
      const modelEntity = (this.entity as any).__modelEntity as pc.Entity;
      if (modelEntity && modelEntity.anim) {
        // Return to run if we were attacking
        const baseLayer = modelEntity.anim.baseLayer;
        if (
          baseLayer &&
          baseLayer.activeState === "attack" &&
          baseLayer.activeStateProgress >= 1
        ) {
          baseLayer.transition("run", 0.2);
        }
      }
    }
  }

  canDealContactDamage(): boolean {
    return this.contactTimer <= 0;
  }

  resetContactCooldown(): void {
    this.contactTimer = ENEMY_CONTACT_COOLDOWN;
    const modelEntity = (this.entity as any).__modelEntity as pc.Entity;
    if (modelEntity && modelEntity.anim) {
      modelEntity.anim.baseLayer?.transition("attack", 0.1);
    }
  }
}
