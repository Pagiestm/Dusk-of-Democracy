const STORAGE_KEY = 'dod_auto_aim';

/** Damage multiplier applied when auto-aim is on (compromise: easier targeting, lower damage) */
export const AUTO_AIM_DAMAGE_MULTIPLIER = 0.85;

export class AimSettings {
    static isAutoAimEnabled(): boolean {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            if (v === null) return true; // default ON
            return v === '1';
        } catch {
            return true;
        }
    }

    static setAutoAim(enabled: boolean): void {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        } catch {}
    }

    static getDamageMultiplier(): number {
        return this.isAutoAimEnabled() ? AUTO_AIM_DAMAGE_MULTIPLIER : 1;
    }
}
