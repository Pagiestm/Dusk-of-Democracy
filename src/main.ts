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

// Get canvas
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Create PlayCanvas application
const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
        antialias: true,
        alpha: false,
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
game.init();

console.log('Rogue Survivors initialized!');
