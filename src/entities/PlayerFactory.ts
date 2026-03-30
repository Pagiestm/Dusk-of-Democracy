import * as pc from 'playcanvas';
import { CharacterDef } from '../types';
import { PlayerController } from '../scripts/PlayerController';
import { Health } from '../scripts/Health';

type AnimHint = 'idle' | 'run' | 'die';

function extractTrack(containerAsset: pc.Asset, hint: AnimHint): pc.AnimTrack | null {
    const anims = (containerAsset.resource as any)?.animations as pc.Asset[] | undefined;
    if (!anims?.length) return null;

    // Filter out empty takes and single-frame poses
    let candidates = anims.filter((a) => {
        const t = a.resource as pc.AnimTrack | null;
        return t && t.name !== 'Take 001' && t.duration > 0.1;
    });
    if (!candidates.length) return null;

    let target: pc.Asset;
    if (hint === 'run') {
        // Run cycle is the shortest clip (< 2s typically)
        candidates.sort((a, b) => (a.resource as pc.AnimTrack).duration - (b.resource as pc.AnimTrack).duration);
        target = candidates[0];
    } else if (hint === 'idle') {
        // Idle is the longest clip
        candidates.sort((a, b) => (b.resource as pc.AnimTrack).duration - (a.resource as pc.AnimTrack).duration);
        target = candidates[0];
    } else {
        // Die: exclude very long clips (> 5s) which are shared noise, then pick the longest
        const noLong = candidates.filter(a => (a.resource as pc.AnimTrack).duration <= 5);
        const pool = noLong.length > 0 ? noLong : candidates;
        pool.sort((a, b) => (b.resource as pc.AnimTrack).duration - (a.resource as pc.AnimTrack).duration);
        target = pool[0];
    }

    const track = target.resource as pc.AnimTrack;
    console.log(`[Anim] ${containerAsset.name} (${hint}) → "${track?.name}" ${track?.duration?.toFixed(2)}s`);
    return track ?? null;
}

function setupAnimations(
    entity: pc.Entity,
    modelEntity: pc.Entity,
    idleAsset: pc.Asset,
    runAsset: pc.Asset,
    dieAsset: pc.Asset
): void {
    const idleTrack = extractTrack(idleAsset, 'idle');
    const runTrack  = extractTrack(runAsset,  'run');
    const dieTrack  = extractTrack(dieAsset,  'die');

    if (!idleTrack || !runTrack || !dieTrack) {
        console.warn('[Anim] Missing tracks, animations disabled');
        return;
    }

    modelEntity.addComponent('anim', { activate: true, speed: 1 });
    const anim = modelEntity.anim!;

    // Build a complete state graph with all animation states upfront.
    // Only START → idle has a transition; run/die are reached via baseLayer.transition().
    anim.loadStateGraph(new pc.AnimStateGraph({
        layers: [{
            name: 'Base',
            states: [
                { name: 'START', speed: 1 },
                { name: 'idle',  speed: 1, loop: true },
                { name: 'run',   speed: 1, loop: true },
                { name: 'die',   speed: 1, loop: false }
            ],
            transitions: [
                { from: 'START', to: 'idle', time: 0, conditions: [] }
            ]
        }],
        parameters: {}
    }));

    anim.assignAnimation('idle', idleTrack);
    anim.assignAnimation('run',  runTrack);
    anim.assignAnimation('die',  dieTrack);

    (entity as any).__modelEntity = modelEntity;
    (entity as any).__hasAnims    = true;
}

export function createPlayer(app: pc.Application, characterDef: CharacterDef): pc.Entity {
    const entity = new pc.Entity('player');

    if (characterDef.modelPath) {
        const containerAsset = new pc.Asset(
            `${characterDef.id}_model`,
            'container',
            { url: characterDef.modelPath }
        );
        app.assets.add(containerAsset);

        if (characterDef.animIdlePath && characterDef.animRunPath && characterDef.animDiePath) {
            const idleAsset = new pc.Asset(`${characterDef.id}_idle`, 'container', { url: characterDef.animIdlePath });
            const runAsset  = new pc.Asset(`${characterDef.id}_run`,  'container', { url: characterDef.animRunPath  });
            const dieAsset  = new pc.Asset(`${characterDef.id}_die`,  'container', { url: characterDef.animDiePath  });

            app.assets.add(idleAsset);
            app.assets.add(runAsset);
            app.assets.add(dieAsset);

            let loaded = 0;
            const onLoaded = () => {
                if (++loaded < 4) return;

                const modelEntity = (containerAsset.resource as pc.ContainerResource).instantiateRenderEntity();
                const s = characterDef.modelScale ?? 0.01;
                modelEntity.setLocalScale(s, s, s);
                entity.addChild(modelEntity);

                setupAnimations(entity, modelEntity, idleAsset, runAsset, dieAsset);
            };

            containerAsset.ready(onLoaded);
            idleAsset.ready(onLoaded);
            runAsset.ready(onLoaded);
            dieAsset.ready(onLoaded);

            app.assets.load(containerAsset);
            app.assets.load(idleAsset);
            app.assets.load(runAsset);
            app.assets.load(dieAsset);
        } else {
            containerAsset.ready((asset: pc.Asset) => {
                const resource = asset.resource as pc.ContainerResource;
                const modelEntity = resource.instantiateRenderEntity();
                const s = characterDef.modelScale ?? 0.01;
                modelEntity.setLocalScale(s, s, s);
                entity.addChild(modelEntity);
            });
            app.assets.load(containerAsset);
        }
    } else {
        // Fallback: colored capsule placeholder
        entity.addComponent('render', { type: 'capsule' });
        const mat = new pc.StandardMaterial();
        mat.diffuse = characterDef.color;
        mat.update();
        for (const mi of entity.render!.meshInstances) {
            mi.material = mat;
        }
    }

    // Script components
    entity.addComponent('script');
    const controller = entity.script!.create(PlayerController) as unknown as PlayerController;
    controller.speed = characterDef.speed;

    const health = entity.script!.create(Health) as unknown as Health;
    health.maxHp = characterDef.hp;
    health.hp = characterDef.hp;
    health.invulnDuration = 0.3;

    entity.tags.add('player');
    entity.setPosition(0, 0.5, 0);
    entity.setLocalScale(0.8, 0.8, 0.8);

    // Lumière ponctuelle autour du joueur (s'allume la nuit via DayNightCycle)
    const torch = new pc.Entity('player_torch');
    torch.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1.0, 0.85, 0.5),
        intensity: 0,
        range: 8,
        castShadows: false,
    });
    torch.setLocalPosition(0, 1.2, 0);
    entity.addChild(torch);

    app.root.addChild(entity);
    return entity;
}
