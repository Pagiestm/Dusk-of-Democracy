import * as pc from 'playcanvas';

/**
 * Creates a visual-only entity for a remote player (co-op partner).
 * No scripts attached — position is driven by network snapshots.
 */
export function createRemotePlayer(
    app: pc.Application,
    playerId: number,
    color: pc.Color
): pc.Entity {
    const entity = new pc.Entity(`remote_player_${playerId}`);

    // Visual: colored capsule
    entity.addComponent('render', { type: 'capsule' });
    const mat = new pc.StandardMaterial();
    mat.diffuse = color;
    mat.update();
    for (const mi of entity.render!.meshInstances) {
        mi.material = mat;
    }

    // Name tag (stored for later)
    (entity as any).__remotePlayerId = playerId;

    entity.tags.add('remote_player');
    entity.setPosition(0, 0.5, 0);
    entity.setLocalScale(0.8, 0.8, 0.8);

    app.root.addChild(entity);
    return entity;
}
