import * as pc from 'playcanvas';
import { Game } from './core/Game';

// Register all script types
import { PlayerController } from './scripts/PlayerController';
import { CameraFollow } from './scripts/CameraFollow';
import { EnemyAI } from './scripts/EnemyAI';
import { Projectile } from './scripts/Projectile';
import { Health } from './scripts/Health';
import { XPPickup } from './scripts/XPPickup';
import { DayNightCycle } from './scripts/DayNightCycle';

declare const Ammo: any;

async function startGame() {
    // Initialize Ammo.js physics engine
    if (typeof Ammo !== 'undefined') {
        await new Promise<void>((resolve) => {
            const result = Ammo({});
            if (result && typeof result.then === 'function') {
                result.then((ammoLib: any) => {
                    (window as any).Ammo = ammoLib;
                    console.log('Ammo.js physics initialized (async)');
                    resolve();
                });
            } else {
                console.log('Ammo.js physics initialized (sync)');
                resolve();
            }
        });
    } else {
        console.warn('Ammo.js not found — physics disabled');
    }

    // Get canvas
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // Create PlayCanvas application
    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        keyboard: new pc.Keyboard(window),
        graphicsDeviceOptions: {
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
        },
    });

    // Configure app
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Handle window resize
    window.addEventListener('resize', () => {
        app.resizeCanvas();
    });

    // Disable right-click context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Start the engine
    app.start();

    // Create and init the game
    const game = new Game(app);
    await game.init();
    console.log('Dusk of Democracy initialized!');
}

startGame();
