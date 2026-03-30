/**
 * AudioManager — gère musiques (loop) et effets sonores (SFX).
 * Utilise l'API Web Audio via des éléments HTMLAudioElement.
 */

const MUSIC_BASE = 'music/';

// ── Music tracks ──
const MUSIC = {
    menu:     `${MUSIC_BASE}menu-music.mp3`,
    trump:    `${MUSIC_BASE}game-music-trump.mp3`,
    kirk:     `${MUSIC_BASE}game-music-kirk.mp3`,
    maduro:   `${MUSIC_BASE}game-music-maduro.mp3`,
    gameover: `${MUSIC_BASE}game-over.mp3`,
} as const;

// ── SFX tracks ──
const SFX = {
    click:      `${MUSIC_BASE}click.mp3`,
    enemyDeath: `${MUSIC_BASE}enemy-death.mp3`,
    xpPickup:   `${MUSIC_BASE}xp-pickup.mp3`,
    levelup:    `${MUSIC_BASE}levelup.mp3`,
    shopBuy:    `${MUSIC_BASE}shop-buy.mp3`,
    waveStart:  `${MUSIC_BASE}wave-start.mp3`,
    playerHit:   `${MUSIC_BASE}player-hit.mp3`,
    playerDeath: `${MUSIC_BASE}player-death.mp3`,
} as const;

type MusicKey = keyof typeof MUSIC;
type SfxKey = keyof typeof SFX;

export class AudioManager {
    private musicVolume = 0.4;
    private sfxVolume = 0.6;

    private currentMusic: HTMLAudioElement | null = null;
    private currentMusicKey: MusicKey | null = null;
    private unlocked = false;

    // Pre-loaded SFX pool (multiple instances for overlapping sounds)
    private sfxCache: Map<string, HTMLAudioElement[]> = new Map();

    constructor() {
        // Preload all SFX
        for (const [, url] of Object.entries(SFX)) {
            this.preloadSfx(url);
        }

        // Unlock audio on first user interaction (mousemove, pointerdown, keydown, touchstart)
        const unlockEvents = ['mousemove', 'pointerdown', 'keydown', 'touchstart'];
        const unlock = () => {
            if (this.unlocked) return;
            this.unlocked = true;
            // Resume pending music
            if (this.currentMusic && this.currentMusic.paused) {
                this.currentMusic.play().catch(() => {});
            }
            for (const evt of unlockEvents) {
                document.removeEventListener(evt, unlock);
            }
        };
        for (const evt of unlockEvents) {
            document.addEventListener(evt, unlock, { once: false });
        }
    }

    // ── Music ──────────────────────────────────────────────────────

    playMusic(key: MusicKey): void {
        if (this.currentMusicKey === key && this.currentMusic && !this.currentMusic.paused) {
            return; // Already playing
        }

        this.stopMusic();

        const audio = new Audio(MUSIC[key]);
        audio.loop = (key !== 'gameover');
        audio.volume = this.musicVolume;
        audio.play().catch(() => {
            // Browser may block autoplay — retry on next user interaction
            const resume = () => {
                audio.play().catch(() => {});
                document.removeEventListener('click', resume);
                document.removeEventListener('keydown', resume);
            };
            document.addEventListener('click', resume, { once: true });
            document.addEventListener('keydown', resume, { once: true });
        });

        this.currentMusic = audio;
        this.currentMusicKey = key;
    }

    /** Play the correct in-game music based on character ID */
    playGameMusic(characterId: string): void {
        const key = (characterId as MusicKey);
        if (key in MUSIC) {
            this.playMusic(key);
        } else {
            this.playMusic('trump'); // fallback
        }
    }

    pauseMusic(): void {
        if (this.currentMusic && !this.currentMusic.paused) {
            this.currentMusic.pause();
        }
    }

    resumeMusic(): void {
        if (this.currentMusic && this.currentMusic.paused && this.currentMusicKey) {
            this.currentMusic.play().catch(() => {});
        }
    }

    stopMusic(): void {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
            this.currentMusicKey = null;
        }
    }

    // ── SFX ────────────────────────────────────────────────────────

    playSfx(key: SfxKey): void {
        const url = SFX[key];
        const pool = this.sfxCache.get(url);
        if (!pool) return;

        // Find a free audio element or reuse oldest
        let audio = pool.find(a => a.ended || a.paused);
        if (!audio) {
            audio = new Audio(url);
            audio.volume = this.sfxVolume;
            pool.push(audio);
        }

        audio.currentTime = 0;
        audio.volume = this.sfxVolume;
        audio.play().catch(() => {});
    }

    stopAllSfx(): void {
        for (const [, pool] of this.sfxCache) {
            for (const audio of pool) {
                if (!audio.paused) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            }
        }
    }

    // ── Volume control ─────────────────────────────────────────────

    setMusicVolume(v: number): void {
        this.musicVolume = Math.max(0, Math.min(1, v));
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
    }

    setSfxVolume(v: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, v));
    }

    getMusicVolume(): number { return this.musicVolume; }
    getSfxVolume(): number { return this.sfxVolume; }

    // ── Internal ───────────────────────────────────────────────────

    private preloadSfx(url: string): void {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = this.sfxVolume;
        this.sfxCache.set(url, [audio]);
    }
}
