import * as pc from 'playcanvas';
import { CAMERA_FOLLOW_SPEED } from '../constants';
import { CameraSettings } from '../core/CameraSettings';

export class CameraFollow extends pc.Script {
    static scriptName = 'cameraFollow';

    target: pc.Entity | null = null;
    followSpeed: number = CAMERA_FOLLOW_SPEED;

    private height: number = 0;
    private angle: number = 0;
    private offsetZ: number = 0;
    private unsubscribe: (() => void) | null = null;

    initialize(): void {
        this.applyPreset();
        this.unsubscribe = CameraSettings.onChange(() => this.applyPreset());
    }

    private applyPreset(): void {
        const p = CameraSettings.getPreset();
        this.height = p.height;
        this.angle = p.angle;
        this.offsetZ = p.offsetZ;
    }

    update(dt: number): void {
        if (!this.target) return;

        const targetPos = this.target.getPosition();
        const currentPos = this.entity.getPosition();

        const desiredX = targetPos.x;
        const desiredY = this.height;
        const desiredZ = targetPos.z + this.offsetZ;

        const lerpFactor = 1 - Math.exp(-this.followSpeed * dt);
        const newX = currentPos.x + (desiredX - currentPos.x) * lerpFactor;
        const newY = currentPos.y + (desiredY - currentPos.y) * lerpFactor;
        const newZ = currentPos.z + (desiredZ - currentPos.z) * lerpFactor;

        this.entity.setPosition(newX, newY, newZ);
        this.entity.setEulerAngles(this.angle, 0, 0);
    }

    setTarget(entity: pc.Entity): void {
        this.target = entity;
    }

    destroy(): void {
        this.unsubscribe?.();
    }
}
