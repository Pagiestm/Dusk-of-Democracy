import * as pc from "playcanvas";
import { EnemyDef } from "../types";
import { EnemyAI } from "../scripts/EnemyAI";
import { Health } from "../scripts/Health";

let enemyCounter = 0;

function setupEnemyAnimations(
  entity: pc.Entity,
  modelEntity: pc.Entity,
  containerAsset: pc.Asset,
): void {
  const anims = (containerAsset.resource as any)?.animations as
    | pc.Asset[]
    | undefined;
  if (!anims || anims.length === 0) return;

  // Score each track against keywords; higher score = better match.
  // Prefer tracks whose final segment ends with the keyword (e.g. "Female_Run"
  // beats "Female_RunningJump" or "Run_Shoot" for the "run" slot).
  const pickBest = (keywords: string[]): pc.AnimTrack | null => {
    let best: pc.AnimTrack | null = null;
    let bestScore = 0;
    for (const a of anims) {
      const track = a.resource as pc.AnimTrack;
      if (!track) continue;
      const full = track.name.toLowerCase();
      const last = full.split(/[|_/]/).pop() ?? full;
      let score = 0;
      for (const kw of keywords) {
        if (last === kw) score = Math.max(score, 3);              // exact final segment
        else if (last.endsWith(kw)) score = Math.max(score, 2);   // ends with keyword
        else if (full.includes(kw)) score = Math.max(score, 1);   // contains anywhere
      }
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    }
    return best;
  };

  let runTrack = pickBest(["run"]);
  let attackTrack = pickBest(["punch", "attack"]);
  let dieTrack = pickBest(["death", "die"]);

  if (!runTrack && anims.length > 0)
    runTrack = anims[0].resource as pc.AnimTrack;
  if (!attackTrack && anims.length > 1)
    attackTrack = anims[1].resource as pc.AnimTrack;
  if (!dieTrack && anims.length > 2)
    dieTrack = anims[2].resource as pc.AnimTrack;

  if (!runTrack && !attackTrack && !dieTrack) return;

  modelEntity.addComponent("anim", { activate: true, speed: 1 });
  const anim = modelEntity.anim!;

  anim.loadStateGraph(
    new pc.AnimStateGraph({
      layers: [
        {
          name: "Base",
          states: [
            { name: "START", speed: 1 },
            { name: "run", speed: 1, loop: true },
            { name: "attack", speed: 1, loop: false },
            { name: "die", speed: 1, loop: false },
          ],
          transitions: [{ from: "START", to: "run", time: 0, conditions: [] }],
        },
      ],
      parameters: {},
    }),
  );

  if (runTrack) anim.assignAnimation("run", runTrack);
  if (attackTrack) anim.assignAnimation("attack", attackTrack);
  if (dieTrack) anim.assignAnimation("die", dieTrack);

  (entity as any).__modelEntity = modelEntity;
  (entity as any).__hasAnims = true;
}

export function createEnemy(
  app: pc.Application,
  def: EnemyDef,
  position: pc.Vec3,
): pc.Entity {
  const entity = new pc.Entity(`enemy_${def.id}_${enemyCounter++}`);

  if (def.modelPath) {
    const url = def.modelPath;
    const containerAsset = new pc.Asset(
      `enemy_${def.id}_model_${enemyCounter}`,
      "container",
      { url },
    );
    app.assets.add(containerAsset);

    containerAsset.ready((asset: pc.Asset) => {
      const resource = asset.resource as pc.ContainerResource;
      if (!resource) return;
      const modelEntity = resource.instantiateRenderEntity();

      const renderCaps = modelEntity.findComponents(
        "render",
      ) as pc.RenderComponent[];
      for (const r of renderCaps) {
        for (const mi of r.meshInstances) {
          // Update material or setup properly if needed
        }
      }

      const s = def.modelScale ?? 0.01;
      modelEntity.setLocalScale(s, s, s);
      modelEntity.setLocalPosition(0, def.modelYOffset ?? 0, 0);
      if (def.modelYRotation !== undefined) {
        modelEntity.setLocalEulerAngles(0, def.modelYRotation, 0);
      }
      entity.addChild(modelEntity);

      // Add health bar visuals
      /*
      const barBg = new pc.Entity("hpbar_bg");
      barBg.addComponent("render", { type: "box" });
      const bgMat = new pc.StandardMaterial();
      bgMat.diffuse = new pc.Color(0.08, 0.08, 0.08);
      bgMat.update();
      for (const mi of barBg.render!.meshInstances) mi.material = bgMat;
      barBg.setLocalScale(1.0 + 0.06, 0.06, 0.06 + 0.02);
      barBg.setLocalPosition(0, s * 0.5 + 2.5, 0);
      entity.addChild(barBg);

      const barFg = new pc.Entity("hpbar_fg");
      barFg.addComponent("render", { type: "box" });
      const fgMat = new pc.StandardMaterial();
      fgMat.diffuse = new pc.Color(0.85, 0.12, 0.12);
      fgMat.emissive = new pc.Color(0.5, 0.05, 0.05);
      fgMat.emissiveIntensity = 1.5;
      fgMat.update();
      for (const mi of barFg.render!.meshInstances) mi.material = fgMat;
      barFg.setLocalScale(1.0, 0.06, 0.06);
      barFg.setLocalPosition(0, s * 0.5 + 2.5, 0.001);
      entity.addChild(barFg);

      (entity as any).__healthBarFg = barFg;
      (entity as any).__healthBarBaseScale = 1.0;
      (entity as any).__maxHp = def.hp;
      */

      setupEnemyAnimations(entity, modelEntity, containerAsset);
    });

    app.assets.load(containerAsset);
  } else {
    // Render: colored box
    entity.addComponent("render", { type: "box" });
    const mat = new pc.StandardMaterial();
    mat.diffuse = def.color;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
      mi.material = mat;
    }
    entity.setLocalScale(def.scale, def.scale, def.scale);
  }

  // ── Scripts ──
  entity.addComponent("script");
  const ai = entity.script!.create(EnemyAI) as unknown as EnemyAI;
  ai.speed = def.speed;
  ai.contactDamage = def.damage;
  if (def.ranged) ai.ranged = { ...def.ranged };

  const health = entity.script!.create(Health) as unknown as Health;
  health.maxHp = def.hp;
  health.hp = def.hp;

  (entity as any).__xpReward = def.xpReward;
  (entity as any).__enemyDef = def;

  entity.tags.add("enemy");

  // Y position should be correctly handled based on model scale vs primitive scale
  const startY = def.modelPath ? 0 : def.scale / 2;
  entity.setPosition(position.x, startY, position.z);

  app.root.addChild(entity);
  return entity;
}
