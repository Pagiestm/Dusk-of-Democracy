import * as pc from 'playcanvas';
import { EnemyDef } from '../types';
import { EnemyAI } from '../scripts/EnemyAI';
import { Health } from '../scripts/Health';

let enemyCounter = 0;

export function createEnemy(app: pc.Application, def: EnemyDef, position: pc.Vec3): pc.Entity {
    const entity = new pc.Entity(`enemy_${def.id}_${enemyCounter++}`);

    // Render: colored box
    entity.addComponent('render', { type: 'box' });
    const mat = new pc.StandardMaterial();
    mat.diffuse = def.color;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    entity.setLocalScale(def.scale, def.scale, def.scale);

    // ── Health bar ──
    const barWidth = 1.0;
    const barHeight = 0.06;
    const barY = (def.scale * 0.5 + 0.2) / def.scale;

    // Background (dark, slightly larger)
    const barBg = new pc.Entity('hpbar_bg');
    barBg.addComponent('render', { type: 'box' });
    const bgMat = new pc.StandardMaterial();
    bgMat.diffuse = new pc.Color(0.08, 0.08, 0.08);
    bgMat.update();
    for (const mi of barBg.render!.meshInstances) mi.material = bgMat;
    barBg.setLocalScale((barWidth + 0.06) / def.scale, barHeight / def.scale, (barHeight + 0.02) / def.scale);
    barBg.setLocalPosition(0, barY, 0);
    entity.addChild(barBg);

    // Foreground (red gradient via emissive)
    const barFg = new pc.Entity('hpbar_fg');
    barFg.addComponent('render', { type: 'box' });
    const fgMat = new pc.StandardMaterial();
    fgMat.diffuse = new pc.Color(0.85, 0.12, 0.12);
    fgMat.emissive = new pc.Color(0.5, 0.05, 0.05);
    fgMat.emissiveIntensity = 1.5;
    fgMat.update();
    for (const mi of barFg.render!.meshInstances) mi.material = fgMat;
    barFg.setLocalScale(barWidth / def.scale, barHeight / def.scale, barHeight / def.scale);
    barFg.setLocalPosition(0, barY, 0);
    entity.addChild(barFg);

    (entity as any).__healthBarFg = barFg;
    (entity as any).__healthBarScale = barWidth / def.scale;

    // ── Scripts ──
    entity.addComponent('script');
    const ai = entity.script!.create(EnemyAI) as unknown as EnemyAI;
    ai.speed = def.speed;
    ai.contactDamage = def.damage;

    const health = entity.script!.create(Health) as unknown as Health;
    health.maxHp = def.hp;
    health.hp = def.hp;

    (entity as any).__xpReward = def.xpReward;
    (entity as any).__enemyDef = def;

    entity.tags.add('enemy');
    entity.setPosition(position.x, def.scale / 2, position.z);

    app.root.addChild(entity);
    return entity;
}
