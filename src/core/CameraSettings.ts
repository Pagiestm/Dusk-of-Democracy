export type CameraMode = 'thirdperson' | 'topdown';

export interface CameraPreset {
    height: number;
    angle: number;
    offsetZ: number;
}

const PRESETS: Record<CameraMode, CameraPreset> = {
    thirdperson: { height: 8, angle: -25, offsetZ: 12 },
    topdown:     { height: 20, angle: -60, offsetZ: 8 },
};

const STORAGE_KEY = 'dod_camera_mode';
const DEFAULT_MODE: CameraMode = 'topdown';

const listeners: Array<(mode: CameraMode, preset: CameraPreset) => void> = [];

export class CameraSettings {
    static getMode(): CameraMode {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            if (v === 'thirdperson' || v === 'topdown') return v;
        } catch {}
        return DEFAULT_MODE;
    }

    static getPreset(): CameraPreset {
        return PRESETS[this.getMode()];
    }

    static setMode(mode: CameraMode): void {
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {}
        const preset = PRESETS[mode];
        for (const cb of listeners) cb(mode, preset);
    }

    static onChange(cb: (mode: CameraMode, preset: CameraPreset) => void): () => void {
        listeners.push(cb);
        return () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
        };
    }
}
