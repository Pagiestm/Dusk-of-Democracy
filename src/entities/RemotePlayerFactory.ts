import * as pc from 'playcanvas';
import { CharacterDef } from '../types';
import { CHARACTERS } from '../data/characters';

type AnimHint = 'idle' | 'run' | 'die';

function extractTrack(containerAsset: pc.Asset, hint: AnimHint): pc.AnimTrack | null {
    const anims = (containerAsset.resource as any)?.animations as pc.Asset[] | undefined;
    if (!anims?.length) return null;

    let candidates = anims.filter((a) => {
        const t = a.resource as pc.AnimTrack | null;
        return t && t.name !== 'Take 001' && t.duration > 0.1;
    });
    if (!candidates.length) return null;

    let target: pc.Asset;
    if (hint === 'run') {
        candidates.sort((a, b) => (a.resource as pc.AnimTrack).duration - (b.resource as pc.AnimTrack).duration);
        target = candidates[0];
    } else if (hint === 'idle') {
        candidates.sort((a, b) => (b.resource as pc.AnimTrack).duration - (a.resource as pc.AnimTrack).duration);
        target = candidates[0];
    } else {
        const noLong = candidates.filter(a => (a.resource as pc.AnimTrack).duration <= 5);
        const pool = noLong.length > 0 ? noLong : candidates;
        pool.sort((a, b) => (b.resource as pc.AnimTrack).duration - (a.resource as pc.AnimTrack).duration);
        target = pool[0];
    }

    return (target.resource as pc.AnimTrack) ?? null;
}

function setupAnimations(
    entity: pc.Entity,
    modelEntity: pc.Entity,
    idleAsset: pc.Asset,
    runAsset: pc.Asset,
    dieAsset: pc.Asset
): void {
    const idleTrack = extractTrack(idleAsset, 'idle');
    const runTrack = extractTrack(runAsset, 'run');
    const dieTrack = extractTrack(dieAsset, 'die');
    if (!idleTrack || !runTrack || !dieTrack) return;

    modelEntity.addComponent('anim', { activate: true, speed: 1 });
    const anim = modelEntity.anim!;
    anim.loadStateGraph(new pc.AnimStateGraph({
        layers: [{
            name: 'Base',
            states: [
                { name: 'START', speed: 1 },
                { name: 'idle', speed: 1, loop: true },
                { name: 'run', speed: 1, loop: true },
                { name: 'die', speed: 1, loop: false }
            ],
            transitions: [
                { from: 'START', to: 'idle', time: 0, conditions: [] }
            ]
        }],
        parameters: {}
    }));

    anim.assignAnimation('idle', idleTrack);
    anim.assignAnimation('run', runTrack);
    anim.assignAnimation('die', dieTrack);

    (entity as any).__modelEntity = modelEntity;
    (entity as any).__hasAnims = true;
}

/**
 * Creates a visual entity for a remote player with the correct character model.
 * No scripts attached — position is driven by network (host input or client snapshots).
 */
export function createRemotePlayerVisual(
    app: pc.Application,
    characterId: string,
    fallbackColor?: pc.Color
): pc.Entity {
    const charDef = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
    const entity = new pc.Entity();

    if (charDef.modelPath) {
        const containerAsset = new pc.Asset(
            `${charDef.id}_remote_${Date.now()}`,
            'container',
            { url: charDef.modelPath }
        );

        app.assets.add(containerAsset);

        if (charDef.animIdlePath && charDef.animRunPath && charDef.animDiePath) {
            const idleAsset = new pc.Asset(`${charDef.id}_remote_idle_${Date.now()}`, 'container', { url: charDef.animIdlePath });
            const runAsset = new pc.Asset(`${charDef.id}_remote_run_${Date.now()}`, 'container', { url: charDef.animRunPath });
            const dieAsset = new pc.Asset(`${charDef.id}_remote_die_${Date.now()}`, 'container', { url: charDef.animDiePath });
            app.assets.add(idleAsset);
            app.assets.add(runAsset);
            app.assets.add(dieAsset);

            let loaded = 0;
            const onLoaded = () => {
                if (++loaded < 4) return;
                const modelEntity = (containerAsset.resource as pc.ContainerResource).instantiateRenderEntity();
                const s = charDef.modelScale ?? 0.01;
                modelEntity.setLocalScale(s, s, s);
                modelEntity.setLocalPosition(0, charDef.modelYOffset ?? 0, 0);
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
                const s = charDef.modelScale ?? 0.01;
                modelEntity.setLocalScale(s, s, s);
                modelEntity.setLocalPosition(0, charDef.modelYOffset ?? 0, 0);
                entity.addChild(modelEntity);
            });

            app.assets.load(containerAsset);
        }
    } else {
        // Fallback: colored capsule
        entity.addComponent('render', { type: 'capsule' });
        const mat = new pc.StandardMaterial();
        mat.diffuse = fallbackColor || charDef.color;
        mat.update();
        for (const mi of entity.render!.meshInstances) {
            mi.material = mat;
        }
    }

    entity.setLocalScale(0.8, 0.8, 0.8);
    entity.setPosition(0, 0.5, 0);

    // Torch light (same as local player)
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
