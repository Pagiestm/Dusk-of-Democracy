import * as pc from 'playcanvas';
import { CharacterDef } from '../types';
import { CHARACTERS } from '../data/characters';

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

        containerAsset.ready((asset: pc.Asset) => {
            const resource = asset.resource as pc.ContainerResource;
            const modelEntity = resource.instantiateRenderEntity();
            const s = charDef.modelScale ?? 0.01;
            modelEntity.setLocalScale(s, s, s);
            modelEntity.setLocalPosition(0, charDef.modelYOffset ?? 0, 0);
            entity.addChild(modelEntity);
        });

        app.assets.load(containerAsset);
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
