import * as pc from 'playcanvas';
import { CAMERA_HEIGHT, CAMERA_ANGLE, CAMERA_FOLLOW_SPEED } from '../constants';

export class CameraFollow extends pc.Script {
    static scriptName = 'cameraFollow';

    target: pc.Entity | null = null;
    height: number = CAMERA_HEIGHT;
    angle: number = CAMERA_ANGLE;
    followSpeed: number = CAMERA_FOLLOW_SPEED;
    offset: pc.Vec3 = new pc.Vec3(0, 0, 8); // slight offset behind

    update(dt: number): void {
        if (!this.target) return;

        const targetPos = this.target.getPosition();
        const currentPos = this.entity.getPosition();

        // Desired position: above and behind the player
        const desiredX = targetPos.x + this.offset.x;
        const desiredY = this.height;
        const desiredZ = targetPos.z + this.offset.z;

        // Smooth follow
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
}
