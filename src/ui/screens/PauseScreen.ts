import { GameState } from '../../constants';
import type { Game } from '../../core/Game';

export class PauseScreen {
    readonly el: HTMLElement;
    private musicSlider!: HTMLInputElement;
    private sfxSlider!: HTMLInputElement;
    private musicLabel!: HTMLSpanElement;
    private sfxLabel!: HTMLSpanElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'pause-screen hidden';
        this.el.innerHTML = `<h2>PAUSE</h2>`;

        // Volume mixer
        const mixer = document.createElement('div');
        mixer.className = 'volume-mixer';

        // Music volume
        const musicRow = this.createVolumeRow(
            '🎵 Musique',
            game.audioManager.getMusicVolume(),
            (v) => {
                game.audioManager.setMusicVolume(v);
                this.musicLabel.textContent = `${Math.round(v * 100)}%`;
            }
        );
        this.musicSlider = musicRow.slider;
        this.musicLabel = musicRow.label;
        mixer.appendChild(musicRow.el);

        // SFX volume
        const sfxRow = this.createVolumeRow(
            '🔊 Effets',
            game.audioManager.getSfxVolume(),
            (v) => {
                game.audioManager.setSfxVolume(v);
                this.sfxLabel.textContent = `${Math.round(v * 100)}%`;
            }
        );
        this.sfxSlider = sfxRow.slider;
        this.sfxLabel = sfxRow.label;
        mixer.appendChild(sfxRow.el);

        this.el.appendChild(mixer);

        const resumeBtn = document.createElement('button');
        resumeBtn.className = 'btn';
        resumeBtn.textContent = 'REPRENDRE';
        resumeBtn.onclick = () => game.resumeGame();
        this.el.appendChild(resumeBtn);

        const quitBtn = document.createElement('button');
        quitBtn.className = 'btn btn-secondary';
        quitBtn.textContent = 'QUITTER';
        quitBtn.onclick = () => game.setState(GameState.MAIN_MENU);
        this.el.appendChild(quitBtn);

        root.appendChild(this.el);
    }

    show(): void {
        // Sync sliders with current values
        this.musicSlider.value = String(this.game.audioManager.getMusicVolume());
        this.musicLabel.textContent = `${Math.round(this.game.audioManager.getMusicVolume() * 100)}%`;
        this.sfxSlider.value = String(this.game.audioManager.getSfxVolume());
        this.sfxLabel.textContent = `${Math.round(this.game.audioManager.getSfxVolume() * 100)}%`;
        this.el.classList.remove('hidden');
    }

    hide(): void { this.el.classList.add('hidden'); }

    private createVolumeRow(
        title: string,
        initialValue: number,
        onChange: (v: number) => void
    ): { el: HTMLElement; slider: HTMLInputElement; label: HTMLSpanElement } {
        const row = document.createElement('div');
        row.className = 'volume-row';

        const name = document.createElement('span');
        name.className = 'volume-name';
        name.textContent = title;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'volume-slider';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.05';
        slider.value = String(initialValue);

        const label = document.createElement('span');
        label.className = 'volume-value';
        label.textContent = `${Math.round(initialValue * 100)}%`;

        slider.oninput = () => {
            const v = parseFloat(slider.value);
            onChange(v);
        };

        row.appendChild(name);
        row.appendChild(slider);
        row.appendChild(label);

        return { el: row, slider, label };
    }
}
