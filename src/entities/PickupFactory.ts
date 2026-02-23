import * as pc from 'playcanvas';
import { XPPickup } from '../scripts/XPPickup';
import { XP_PICKUP_SIZE } from '../constants';

let pickupCounter = 0;

export function createXPPickup(app: pc.Application, position: pc.Vec3, xpValue: number): pc.Entity {
    const entity = new pc.Entity(`xp_pickup_${pickupCounter++}`);

    // Render: small green gem (diamond shape = rotated box)
    entity.addComponent('render', { type: 'box' });
    entity.setLocalScale(XP_PICKUP_SIZE, XP_PICKUP_SIZE, XP_PICKUP_SIZE);
    entity.setEulerAngles(45, 45, 0); // diamond shape

    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0.2, 0.9, 0.3);
    mat.emissive = new pc.Color(0.1, 0.5, 0.15);
    mat.emissiveIntensity = 2;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    // Script
    entity.addComponent('script');
    const pickup = entity.script!.create(XPPickup) as unknown as XPPickup;
    pickup.xpValue = xpValue;

    entity.tags.add('pickup');
    entity.tags.add('xp_pickup');
    entity.setPosition(position.x, 0.5, position.z);

    app.root.addChild(entity);
    return entity;
}
