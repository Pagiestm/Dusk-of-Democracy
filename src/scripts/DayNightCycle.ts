import * as pc from 'playcanvas';
import { DAY_CYCLE_DURATION, GameState } from '../constants';

/**
 * Cycle jour / nuit visuel.
 *
 * Phases (sur le cycle normalisé 0→1) :
 *   0.00 → 0.38  Jour pur       (ciel bleu, soleil vif)
 *   0.38 → 0.50  Coucher        (ciel orangé → noir)
 *   0.50 → 0.88  Nuit pure      (ciel noir, lumière froide, ennemis renforcés)
 *   0.88 → 1.00  Aube           (ciel noir → bleu)
 */
export class DayNightCycle extends pc.Script {
    static scriptName = 'dayNightCycle';

    cycleDuration: number = DAY_CYCLE_DURATION;
    timeOfDay: number = 0; // 0 = début du jour

    // Couleurs du ciel (clearColor caméra)
    private readonly SKY_DAY   = new pc.Color(0.35, 0.58, 0.88);  // bleu clair
    private readonly SKY_DUSK  = new pc.Color(0.60, 0.22, 0.05);  // orangé crépuscule
    private readonly SKY_NIGHT = new pc.Color(0.01, 0.02, 0.08);  // noir profond

    // Lumière ambiante
    private readonly AMB_DAY   = new pc.Color(0.50, 0.50, 0.55);
    private readonly AMB_NIGHT = new pc.Color(0.03, 0.03, 0.12);

    // Soleil / Lune
    private readonly SUN_DAY   = new pc.Color(1.00, 0.95, 0.80);
    private readonly SUN_DUSK  = new pc.Color(1.00, 0.45, 0.10);
    private readonly SUN_NIGHT = new pc.Color(0.25, 0.28, 0.55);

    private cameraEntity: pc.Entity | null = null;

    initialize(): void {
        this.cameraEntity = this.app.root.findByName('camera') as pc.Entity | null;
        // Appliquer les couleurs de jour dès le départ
        this.applyColors(0);
    }

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (!game || game.state !== GameState.PLAYING) return;

        this.timeOfDay = (this.timeOfDay + dt / this.cycleDuration) % 1.0;

        const nf = this.computeNightFactor(this.timeOfDay);
        this.applyColors(nf);

        // Rotation du soleil
        this.entity.setEulerAngles(this.timeOfDay * 360 - 90, 135, 0);

        // Exposer pour les autres systèmes
        (this.app as any).__nightFactor  = nf;
        (this.app as any).__timeOfDay    = this.timeOfDay;
    }

    // -------------------------------------------------------
    // Rendu des couleurs
    // -------------------------------------------------------
    private applyColors(nf: number): void {
        // Ciel : jour → crépuscule (orange) → nuit → aube → jour
        const sky = nf < 0.5
            ? this.lerpColor(this.SKY_DAY,  this.SKY_DUSK,  nf * 2)
            : this.lerpColor(this.SKY_DUSK, this.SKY_NIGHT, (nf - 0.5) * 2);

        if (this.cameraEntity?.camera) {
            this.cameraEntity.camera.clearColor = sky;
        }

        // Lumière ambiante
        this.app.scene.ambientLight = this.lerpColor(this.AMB_DAY, this.AMB_NIGHT, nf);

        // Lumière directionnelle (soleil/lune)
        const light = this.entity.light;
        if (light) {
            const sunColor = nf < 0.5
                ? this.lerpColor(this.SUN_DAY,  this.SUN_DUSK,  nf * 2)
                : this.lerpColor(this.SUN_DUSK, this.SUN_NIGHT, (nf - 0.5) * 2);
            light.color     = sunColor;
            light.intensity = pc.math.lerp(1.5, 0.35, nf);
        }

        // Torche du joueur : s'allume progressivement dès le crépuscule
        const torch = this.app.root.findByName('player_torch') as pc.Entity | null;
        const torchLight = (torch as pc.Entity | null)?.light;
        if (torchLight) {
            torchLight.intensity = pc.math.lerp(0, 3.0, nf);
        }
    }

    // -------------------------------------------------------
    // Calcul du facteur nuit
    //   0 = jour pur  |  1 = nuit pure
    // -------------------------------------------------------
    computeNightFactor(t: number): number {
        const D_END  = 0.38; // fin du jour
        const N_ON   = 0.50; // nuit complète
        const N_OFF  = 0.88; // début de l'aube
        const D_ON   = 1.00; // retour jour

        if (t < D_END)  return 0;
        if (t < N_ON)   return this.smoothstep((t - D_END)  / (N_ON  - D_END));
        if (t < N_OFF)  return 1;
        return this.smoothstep(1 - (t - N_OFF) / (D_ON - N_OFF));
    }

    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    private smoothstep(x: number): number {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    private lerpColor(a: pc.Color, b: pc.Color, t: number): pc.Color {
        const out = new pc.Color();
        out.lerp(a, b, Math.max(0, Math.min(1, t)));
        return out;
    }

    isNight(): boolean {
        return this.computeNightFactor(this.timeOfDay) > 0.5;
    }

    getNightFactor(): number {
        return this.computeNightFactor(this.timeOfDay);
    }
}

