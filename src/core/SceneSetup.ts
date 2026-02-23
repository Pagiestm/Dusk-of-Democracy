import * as pc from 'playcanvas';
import { ARENA_SIZE, CAMERA_HEIGHT, CAMERA_ANGLE } from '../constants';

export function setupScene(app: pc.Application): { camera: pc.Entity; light: pc.Entity } {
    // === Ground plane ===
    const ground = new pc.Entity('ground');
    ground.addComponent('render', {
        type: 'plane',
    });
    ground.setLocalScale(ARENA_SIZE, 1, ARENA_SIZE);
    ground.setPosition(0, 0, 0);

    // Set ground material
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.diffuse = new pc.Color(0.15, 0.2, 0.15);
    groundMaterial.update();
    const meshInstances = ground.render!.meshInstances;
    for (const mi of meshInstances) {
        mi.material = groundMaterial;
    }

    app.root.addChild(ground);

    // === Grid lines on ground (visual reference) ===
    const gridGround = new pc.Entity('grid-overlay');
    gridGround.addComponent('render', { type: 'plane' });
    gridGround.setLocalScale(ARENA_SIZE, 1, ARENA_SIZE);
    gridGround.setPosition(0, 0.01, 0);

    const gridMat = new pc.StandardMaterial();
    gridMat.diffuse = new pc.Color(0.2, 0.25, 0.2);
    gridMat.opacity = 0.3;
    gridMat.blendType = pc.BLEND_NORMAL;
    gridMat.update();
    for (const mi of gridGround.render!.meshInstances) {
        mi.material = gridMat;
    }
    app.root.addChild(gridGround);

    // === Arena walls (visual boundaries) ===
    const wallHeight = 2;
    const wallThickness = 1;
    const half = ARENA_SIZE / 2;
    const wallColor = new pc.Color(0.3, 0.3, 0.35);

    const wallConfigs = [
        { pos: [0, wallHeight / 2, -half], scale: [ARENA_SIZE, wallHeight, wallThickness] },  // North
        { pos: [0, wallHeight / 2, half], scale: [ARENA_SIZE, wallHeight, wallThickness] },   // South
        { pos: [-half, wallHeight / 2, 0], scale: [wallThickness, wallHeight, ARENA_SIZE] },  // West
        { pos: [half, wallHeight / 2, 0], scale: [wallThickness, wallHeight, ARENA_SIZE] },   // East
    ];

    wallConfigs.forEach((cfg, i) => {
        const wall = new pc.Entity(`wall_${i}`);
        wall.addComponent('render', { type: 'box' });
        wall.setPosition(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        wall.setLocalScale(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
        wall.tags.add('wall');

        const mat = new pc.StandardMaterial();
        mat.diffuse = wallColor;
        mat.update();
        for (const mi of wall.render!.meshInstances) {
            mi.material = mat;
        }

        app.root.addChild(wall);
    });

    // === Camera ===
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.15),
        farClip: 200,
        fov: 45,
    });
    camera.setPosition(0, CAMERA_HEIGHT, 15);
    camera.setEulerAngles(CAMERA_ANGLE, 0, 0);
    app.root.addChild(camera);

    // === Directional light (sun) ===
    const light = new pc.Entity('sun');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 0.95, 0.85),
        intensity: 1.2,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048,
        shadowDistance: 60,
    });
    light.setEulerAngles(45, 135, 0);
    app.root.addChild(light);

    // === Ambient light ===
    app.scene.ambientLight = new pc.Color(0.3, 0.3, 0.4);

    return { camera, light };
}
