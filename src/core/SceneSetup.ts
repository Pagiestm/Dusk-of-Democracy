import * as pc from 'playcanvas';
import { CAMERA_HEIGHT, CAMERA_ANGLE } from '../constants';
import { getCachedModel } from './AssetLoader';
import { COLLISION_DATA } from '../data/collisionData';
import { LIGHT_DATA } from '../data/lightData';

const ARENA_PATH = 'assets/models/map/arena.glb';
const MAP_BASE_PATH = 'assets/models/map/';
const MAP_SCALE = 5;

/** Paths needed for preloading */
export function getMapModelPaths(): string[] {
    const paths = new Set<string>([ARENA_PATH]);
    for (const c of COLLISION_DATA) {
        paths.add(MAP_BASE_PATH + c.glb);
    }
    return Array.from(paths);
}

export function setupScene(app: pc.Application): { camera: pc.Entity; light: pc.Entity } {
    // === Load arena GLB ===
    const arenaAsset = getCachedModel(ARENA_PATH);

    if (arenaAsset) {
        const container = arenaAsset.resource as any;
        const arena = container.instantiateRenderEntity() as pc.Entity;
        arena.name = 'arena';
        arena.setPosition(0, 0, 0);
        arena.setLocalScale(MAP_SCALE, MAP_SCALE, MAP_SCALE);
        app.root.addChild(arena);

        // Add physics colliders from editor data
        addPhysicsColliders(app);

        // Add streetlamp lights from editor data
        addStreetLights(app);

        console.log('Map chargee avec succes');
    } else {
        console.warn('Map non chargee, fallback');
        buildFallbackGround(app);
    }

    // === Camera ===
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.35, 0.58, 0.88),
        farClip: 500,
        fov: 45,
    });
    camera.setPosition(0, CAMERA_HEIGHT, 15);
    camera.setEulerAngles(CAMERA_ANGLE, 0, 0);
    app.root.addChild(camera);

    // === Directional light (sun) ===
    const light = new pc.Entity('sun');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 0.95, 0.80),
        intensity: 1.5,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048,
        shadowDistance: 100,
    });
    light.setEulerAngles(45, 135, 0);
    app.root.addChild(light);

    // === Ambient light ===
    app.scene.ambientLight = new pc.Color(0.50, 0.50, 0.55);

    return { camera, light };
}

/** For each collision entry, instantiate the GLB to read its mesh AABB,
 *  then create a static box collider at the world position. */
function addPhysicsColliders(app: pc.Application): void {
    let count = 0;
    const collidersRoot = new pc.Entity('colliders');
    app.root.addChild(collidersRoot);

    for (const entry of COLLISION_DATA) {
        const asset = getCachedModel(MAP_BASE_PATH + entry.glb);
        if (!asset) continue;

        const container = asset.resource as any;

        // Temporarily instantiate to read AABB
        const probe = container.instantiateRenderEntity() as pc.Entity;
        probe.setLocalScale(entry.s[0], entry.s[1], entry.s[2]);
        probe.setLocalEulerAngles(entry.r[0], entry.r[1], entry.r[2]);
        app.root.addChild(probe);

        // Compute combined AABB from all mesh instances (in world after transform)
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        probe.forEach((node: pc.GraphNode) => {
            const e = node as pc.Entity;
            if (!e.render) return;
            for (const mi of e.render.meshInstances) {
                const aabb = mi.aabb;
                if (!aabb) continue;
                const c = aabb.center;
                const h = aabb.halfExtents;
                minX = Math.min(minX, c.x - h.x);
                minY = Math.min(minY, c.y - h.y);
                minZ = Math.min(minZ, c.z - h.z);
                maxX = Math.max(maxX, c.x + h.x);
                maxY = Math.max(maxY, c.y + h.y);
                maxZ = Math.max(maxZ, c.z + h.z);
            }
        });

        probe.destroy();

        if (minX === Infinity) continue;

        // Local AABB center offset (relative to entity origin, since probe is at 0,0,0)
        const offsetX = (minX + maxX) / 2;
        const offsetY = (minY + maxY) / 2;
        const offsetZ = (minZ + maxZ) / 2;

        // Half-extents scaled by map scale
        const halfX = ((maxX - minX) / 2) * MAP_SCALE;
        const halfY = ((maxY - minY) / 2) * MAP_SCALE;
        const halfZ = ((maxZ - minZ) / 2) * MAP_SCALE;

        // World position = (entity world pos + AABB offset) * map scale
        const worldX = (entry.p[0] + offsetX) * MAP_SCALE;
        const worldY = (entry.p[1] + offsetY) * MAP_SCALE;
        const worldZ = (entry.p[2] + offsetZ) * MAP_SCALE;

        const colEntity = new pc.Entity(`col_${count}`);
        colEntity.setPosition(worldX, worldY, worldZ);

        colEntity.addComponent('rigidbody', {
            type: 'static',
            mass: 0,
        });

        colEntity.addComponent('collision', {
            type: 'box',
            halfExtents: new pc.Vec3(halfX, halfY, halfZ),
        });

        collidersRoot.addChild(colEntity);
        count++;
    }

    console.log(`Physics: ${count}/${COLLISION_DATA.length} box colliders ajoutes`);
}

function addStreetLights(app: pc.Application): void {
    const lightsRoot = new pc.Entity('street-lights');
    app.root.addChild(lightsRoot);

    for (let i = 0; i < LIGHT_DATA.length; i++) {
        const entry = LIGHT_DATA[i];
        const light = new pc.Entity(`street-light-${i}`);
        light.tags.add('street-light');

        light.addComponent('light', {
            type: entry.type,
            color: new pc.Color(entry.color[0], entry.color[1], entry.color[2]),
            intensity: entry.intensity,
            range: entry.range * MAP_SCALE,
            innerConeAngle: entry.innerConeAngle,
            outerConeAngle: entry.outerConeAngle,
            castShadows: false,
        });

        light.setPosition(entry.pos[0] * MAP_SCALE, entry.pos[1] * MAP_SCALE, entry.pos[2] * MAP_SCALE);
        light.setEulerAngles(entry.rotation[0], entry.rotation[1], entry.rotation[2]);
        light.enabled = false; // off by default, DayNightCycle will enable at night
        lightsRoot.addChild(light);
    }

    console.log(`Lights: ${LIGHT_DATA.length} street lights ajoutees`);
}

function buildFallbackGround(app: pc.Application): void {
    const ground = new pc.Entity('ground');
    ground.addComponent('render', { type: 'plane' });
    ground.setLocalScale(80, 1, 80);
    ground.setPosition(0, 0, 0);

    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0.3, 0.3, 0.35);
    mat.update();
    for (const mi of ground.render!.meshInstances) {
        mi.material = mat;
    }
    app.root.addChild(ground);
}
