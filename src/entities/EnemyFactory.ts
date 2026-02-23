import * as pc from 'playcanvas';
import { EnemyDef } from '../types';
import { EnemyAI } from '../scripts/EnemyAI';
import { Health } from '../scripts/Health';

let enemyCounter = 0;

export function createEnemy(app: pc.Application, def: EnemyDef, position: pc.Vec3): pc.Entity {
    const entity = new pc.Entity(`enemy_${def.id}_${enemyCounter++}`);

    // Render: colored box (placeholder)
    entity.addComponent('render', { type: 'box' });
    const mat = new pc.StandardMaterial();
    mat.diffuse = def.color;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    entity.setLocalScale(def.scale, def.scale, def.scale);

    // Scripts
    entity.addComponent('script');
    const ai = entity.script!.create(EnemyAI) as unknown as EnemyAI;
    ai.speed = def.speed;
    ai.contactDamage = def.damage;

    const health = entity.script!.create(Health) as unknown as Health;
    health.maxHp = def.hp;
    health.hp = def.hp;

    // Store xp reward on entity for death handling
    (entity as any).__xpReward = def.xpReward;
    (entity as any).__enemyDef = def;

    entity.tags.add('enemy');
    entity.setPosition(position.x, def.scale / 2, position.z);

    app.root.addChild(entity);
    return entity;
}
