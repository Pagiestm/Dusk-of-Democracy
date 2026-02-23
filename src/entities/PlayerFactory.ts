import * as pc from 'playcanvas';
import { CharacterDef } from '../types';
import { PlayerController } from '../scripts/PlayerController';
import { Health } from '../scripts/Health';

export function createPlayer(app: pc.Application, characterDef: CharacterDef): pc.Entity {
    const entity = new pc.Entity('player');

    // Render: colored capsule (placeholder until 3D models)
    entity.addComponent('render', { type: 'capsule' });
    const mat = new pc.StandardMaterial();
    mat.diffuse = characterDef.color;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    // Script components
    entity.addComponent('script');
    const controller = entity.script!.create(PlayerController) as unknown as PlayerController;
    controller.speed = characterDef.speed;

    const health = entity.script!.create(Health) as unknown as Health;
    health.maxHp = characterDef.hp;
    health.hp = characterDef.hp;
    health.invulnDuration = 0.3; // brief invulnerability after hit

    entity.tags.add('player');
    entity.setPosition(0, 0.5, 0);
    entity.setLocalScale(0.8, 0.8, 0.8);

    app.root.addChild(entity);
    return entity;
}
