import * as pc from 'playcanvas';
import { InputState } from '../types';

export class InputManager {
    private app: pc.Application;
    private keyboard: pc.Keyboard;
    private mouse: pc.Mouse;
    private state: InputState;
    private mousePos: { x: number; y: number } = { x: 0, y: 0 };
    private mouseDown: boolean = false;
    private gamepadDeadZone = 0.15;

    constructor(app: pc.Application) {
        this.app = app;
        this.keyboard = app.keyboard!;
        this.mouse = app.mouse!;

        this.state = {
            moveDirection: new pc.Vec2(),
            aimDirection: new pc.Vec2(),
            aimWorldPos: new pc.Vec3(),
            fire: false,
            interact: false,
            pause: false,
        };

        // Track mouse position
        this.mouse.on(pc.EVENT_MOUSEMOVE, (event: pc.MouseEvent) => {
            this.mousePos.x = event.x;
            this.mousePos.y = event.y;
        });

        this.mouse.on(pc.EVENT_MOUSEDOWN, () => {
            this.mouseDown = true;
        });

        this.mouse.on(pc.EVENT_MOUSEUP, () => {
            this.mouseDown = false;
        });
    }

    update(playerEntity: pc.Entity | null, cameraEntity: pc.Entity | null): InputState {
        // === Movement (WASD / Arrow keys) ===
        let mx = 0;
        let mz = 0;

        if (this.keyboard.isPressed(pc.KEY_Z) || this.keyboard.isPressed(pc.KEY_UP)) mz -= 1;
        if (this.keyboard.isPressed(pc.KEY_S) || this.keyboard.isPressed(pc.KEY_DOWN)) mz += 1;
        if (this.keyboard.isPressed(pc.KEY_Q) || this.keyboard.isPressed(pc.KEY_LEFT)) mx -= 1;
        if (this.keyboard.isPressed(pc.KEY_D) || this.keyboard.isPressed(pc.KEY_RIGHT)) mx += 1;

        // Gamepad
        const gamepads = this.app.gamepads;
        if (gamepads) {
            const pad = navigator.getGamepads?.()[0];
            if (pad) {
                const lx = this.applyDeadZone(pad.axes[0] ?? 0);
                const ly = this.applyDeadZone(pad.axes[1] ?? 0);
                if (lx !== 0 || ly !== 0) {
                    mx = lx;
                    mz = ly;
                }

                // Right stick for aim
                const rx = this.applyDeadZone(pad.axes[2] ?? 0);
                const ry = this.applyDeadZone(pad.axes[3] ?? 0);
                if (rx !== 0 || ry !== 0) {
                    this.state.aimDirection.set(rx, ry);
                }

                // Fire: right trigger or A button
                this.state.fire = this.mouseDown || (pad.buttons[7]?.pressed ?? false);

                // Pause: start button
                this.state.pause = this.keyboard.wasPressed(pc.KEY_ESCAPE) || (pad.buttons[9]?.pressed ?? false);

                // Interact: E key or A button
                this.state.interact = this.keyboard.wasPressed(pc.KEY_E) || (pad.buttons[0]?.pressed ?? false);
            }
        }

        // Normalize movement
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
            this.state.moveDirection.set(mx / len, mz / len);
        } else {
            this.state.moveDirection.set(0, 0);
        }

        // === Aim (mouse -> world position on ground plane y=0) ===
        if (cameraEntity && playerEntity) {
            const camera = cameraEntity.camera!;
            const screenPos = new pc.Vec3(this.mousePos.x, this.mousePos.y, 1);

            // Get ray from camera through mouse position
            const nearPos = camera.screenToWorld(screenPos.x, screenPos.y, camera.nearClip);
            const farPos = camera.screenToWorld(screenPos.x, screenPos.y, camera.farClip);

            // Intersect with ground plane (y = 0)
            const dir = new pc.Vec3().sub2(farPos, nearPos);
            if (dir.y !== 0) {
                const t = -nearPos.y / dir.y;
                const groundPos = new pc.Vec3(
                    nearPos.x + dir.x * t,
                    0,
                    nearPos.z + dir.z * t
                );
                this.state.aimWorldPos.copy(groundPos);

                // Aim direction from player to ground hit
                const playerPos = playerEntity.getPosition();
                const aimDir = new pc.Vec2(
                    groundPos.x - playerPos.x,
                    groundPos.z - playerPos.z
                );
                const aimLen = Math.sqrt(aimDir.x * aimDir.x + aimDir.y * aimDir.y);
                if (aimLen > 0) {
                    this.state.aimDirection.set(aimDir.x / aimLen, aimDir.y / aimLen);
                }
            }
        }

        // Keyboard-only fire/pause/interact
        if (!navigator.getGamepads?.()?.[0]) {
            this.state.fire = this.mouseDown;
            this.state.pause = this.keyboard.wasPressed(pc.KEY_ESCAPE);
            this.state.interact = this.keyboard.wasPressed(pc.KEY_E);
        }

        return this.state;
    }

    getState(): InputState {
        return this.state;
    }

    private applyDeadZone(value: number): number {
        return Math.abs(value) < this.gamepadDeadZone ? 0 : value;
    }
}
