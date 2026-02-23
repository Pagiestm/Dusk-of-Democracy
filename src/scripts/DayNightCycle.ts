import * as pc from 'playcanvas';
import { DAY_CYCLE_DURATION, GameState } from '../constants';

export class DayNightCycle extends pc.Script {
    static scriptName = 'dayNightCycle';

    cycleDuration: number = DAY_CYCLE_DURATION;
    timeOfDay: number = 0; // 0 = noon, 0.5 = midnight

    private dayAmbient: pc.Color = new pc.Color(0.3, 0.3, 0.4);
    private nightAmbient: pc.Color = new pc.Color(0.05, 0.05, 0.15);
    private daySunColor: pc.Color = new pc.Color(1, 0.95, 0.85);
    private nightSunColor: pc.Color = new pc.Color(0.3, 0.3, 0.6);

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (!game || game.state !== GameState.PLAYING) return;

        this.timeOfDay = (this.timeOfDay + dt / this.cycleDuration) % 1.0;

        // Sun rotation
        const sunAngle = this.timeOfDay * 360;
        this.entity.setEulerAngles(sunAngle - 90, 135, 0);

        // Night factor: 0 at noon, 1 at midnight
        const nightFactor = Math.max(0, Math.sin(this.timeOfDay * Math.PI * 2));

        // Ambient light lerp
        const ambient = new pc.Color();
        ambient.lerp(this.dayAmbient, this.nightAmbient, nightFactor);
        this.app.scene.ambientLight = ambient;

        // Sun color lerp
        const light = this.entity.light;
        if (light) {
            const sunColor = new pc.Color();
            sunColor.lerp(this.daySunColor, this.nightSunColor, nightFactor);
            light.color = sunColor;
            light.intensity = 1.2 - nightFactor * 0.6;
        }

        // Expose night factor for other systems
        (this.app as any).__nightFactor = nightFactor;
    }

    isNight(): boolean {
        return this.timeOfDay > 0.25 && this.timeOfDay < 0.75;
    }

    getNightFactor(): number {
        return Math.max(0, Math.sin(this.timeOfDay * Math.PI * 2));
    }
}
