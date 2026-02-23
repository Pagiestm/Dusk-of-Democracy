import * as pc from 'playcanvas';
import { Projectile } from '../scripts/Projectile';
import { PROJECTILE_SIZE } from '../constants';

let projectileCounter = 0;

export function createProjectile(
    app: pc.Application,
    position: pc.Vec3,
    direction: pc.Vec3,
    speed: number,
    lifetime: number,
    damage: number,
    color?: pc.Color
): pc.Entity {
    const entity = new pc.Entity(`projectile_${projectileCounter++}`);

    // Render: small sphere
    entity.addComponent('render', { type: 'sphere' });
    entity.setLocalScale(PROJECTILE_SIZE * 2, PROJECTILE_SIZE * 2, PROJECTILE_SIZE * 2);

    const mat = new pc.StandardMaterial();
    mat.diffuse = color || new pc.Color(1, 1, 0.3);
    mat.emissive = color ? color.clone() : new pc.Color(0.8, 0.8, 0.2);
    mat.emissiveIntensity = 2;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    // Script
    entity.addComponent('script');
    const proj = entity.script!.create(Projectile) as unknown as Projectile;
    proj.speed = speed;
    proj.lifetime = lifetime;
    proj.damage = damage;
    proj.direction = direction.clone().normalize();

    entity.tags.add('projectile');
    entity.tags.add('player_projectile');
    entity.setPosition(position.x, 0.5, position.z);

    app.root.addChild(entity);
    return entity;
}
