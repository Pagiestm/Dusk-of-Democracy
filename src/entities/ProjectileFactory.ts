import * as pc from 'playcanvas';
import { Projectile } from '../scripts/Projectile';
import { PROJECTILE_SIZE } from '../constants';
import { getCachedModel } from '../core/AssetLoader';

const BULLET_MODEL_PATH = 'assets/bullet/bullet.glb';

let projectileCounter = 0;

export function createProjectile(
    app: pc.Application,
    position: pc.Vec3,
    direction: pc.Vec3,
    speed: number,
    lifetime: number,
    damage: number,
    color?: pc.Color,
    isEnemy: boolean = false,
    modelPath?: string,
    modelScale?: number,
    text?: string
): pc.Entity {
    const entity = new pc.Entity(`projectile_${projectileCounter++}`);

    // Pick the model: weapon-specific override > enemy default > none
    const customAsset = modelPath ? getCachedModel(modelPath) : undefined;
    const bulletAsset = !customAsset && isEnemy ? getCachedModel(BULLET_MODEL_PATH) : undefined;

    if (text) {
        // Text projectile: no 3D visual, just metadata for the UI to render.
        (entity as any).__projectileText = text;
    } else if (customAsset) {
        const container = customAsset.resource as any;
        const model = container.instantiateRenderEntity() as pc.Entity;
        const s = modelScale ?? 1;
        model.setLocalScale(s, s, s);
        // Yaw the model toward direction. The bird model points along +X by default,
        // so subtract 90° from the yaw computed for +Z forward.
        const yaw = Math.atan2(direction.x, direction.z) * (180 / Math.PI) - 90;
        model.setLocalEulerAngles(0, yaw, 0);
        entity.addChild(model);
    } else if (bulletAsset) {
        const container = bulletAsset.resource as any;
        const bullet = container.instantiateRenderEntity() as pc.Entity;
        bullet.setLocalScale(1.5, 1.5, 1.5);

        // The bullet model stands up along Y by default; lay it horizontally
        // (rotate -90° around X so its tip points along +Z), then yaw to aim.
        const yaw = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
        bullet.setLocalEulerAngles(-90, yaw, 0);

        // Make the bullet emissive yellow so it pops visually
        const emissiveMat = new pc.StandardMaterial();
        emissiveMat.diffuse = new pc.Color(1, 0.9, 0.2);
        emissiveMat.emissive = new pc.Color(1, 0.7, 0.1);
        emissiveMat.emissiveIntensity = 3;
        emissiveMat.update();
        bullet.forEach((node: pc.GraphNode) => {
            const e = node as pc.Entity;
            if (e.render) {
                for (const mi of e.render.meshInstances) mi.material = emissiveMat;
            }
        });

        entity.addChild(bullet);
    } else {
        // Fallback: small emissive sphere
        entity.addComponent('render', { type: 'sphere' });
        entity.setLocalScale(PROJECTILE_SIZE * 2, PROJECTILE_SIZE * 2, PROJECTILE_SIZE * 2);
        const mat = new pc.StandardMaterial();
        const defaultColor = isEnemy ? new pc.Color(0.5, 1, 0.3) : new pc.Color(1, 1, 0.3);
        mat.diffuse = color || defaultColor;
        mat.emissive = color ? color.clone() : (isEnemy ? new pc.Color(0.3, 0.8, 0.2) : new pc.Color(0.8, 0.8, 0.2));
        mat.emissiveIntensity = 2;
        mat.update();
        for (const mi of entity.render!.meshInstances) mi.material = mat;
    }

    // Script
    entity.addComponent('script');
    const proj = entity.script!.create(Projectile) as unknown as Projectile;
    proj.speed = speed;
    proj.lifetime = lifetime;
    proj.damage = damage;
    proj.direction = direction.clone().normalize();

    entity.tags.add('projectile');
    entity.tags.add(isEnemy ? 'enemy_projectile' : 'player_projectile');
    entity.setPosition(position.x, 0.5, position.z);

    app.root.addChild(entity);
    return entity;
}
