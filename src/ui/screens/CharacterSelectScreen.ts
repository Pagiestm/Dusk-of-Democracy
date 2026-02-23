import { GameState } from '../../constants';
import { CHARACTERS } from '../../data/characters';
import { launchCanvasBg } from '../shared/canvasBackground';
import type { Game } from '../../core/Game';

export class CharacterSelectScreen {
    readonly el: HTMLElement;
    private bgStop: (() => void) | null = null;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'sel-screen hidden';

        // Canvas background
        const canvas = document.createElement('canvas');
        canvas.className = 'menu-canvas';
        this.el.appendChild(canvas);
        (this.el as any).__canvas = canvas;

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay sel-overlay';
        this.el.appendChild(overlay);

        // Content
        const content = document.createElement('div');
        content.className = 'sel-content';

        // Header
        const header = document.createElement('div');
        header.className = 'sel-header';
        header.innerHTML = `
            <div class="sel-step">ÉTAPE 1 · 2</div>
            <h2 class="sel-title">Choisis ton combattant</h2>
            <div class="sel-rule"></div>
        `;
        content.appendChild(header);

        // Character cards
        const grid = document.createElement('div');
        grid.className = 'sel-char-grid';

        for (const char of CHARACTERS) {
            const r = Math.floor(char.color.r * 255);
            const g = Math.floor(char.color.g * 255);
            const b = Math.floor(char.color.b * 255);
            const hpPct  = Math.round(char.hp    / 150 * 100);
            const spdPct = Math.round(char.speed / 10  * 100);

            const card = document.createElement('div');
            card.className = 'sel-char-card';
            card.innerHTML = `
                <div class="sel-char-avatar" style="
                    background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.28), transparent 60%),
                                rgb(${r},${g},${b});
                    box-shadow: 0 0 35px rgba(${r},${g},${b},0.5);"></div>
                <div class="sel-char-name">${char.name}</div>
                <div class="sel-char-desc">${char.description}</div>
                <div class="sel-char-stats">
                    <div class="sel-stat">
                        <div class="sel-stat-row">
                            <span class="sel-stat-label">♥ PV</span>
                            <span class="sel-stat-val">${char.hp}</span>
                        </div>
                        <div class="sel-stat-bar"><div class="sel-stat-fill hp-fill" style="width:${hpPct}%"></div></div>
                    </div>
                    <div class="sel-stat">
                        <div class="sel-stat-row">
                            <span class="sel-stat-label">⚡ VITESSE</span>
                            <span class="sel-stat-val">${char.speed}</span>
                        </div>
                        <div class="sel-stat-bar"><div class="sel-stat-fill spd-fill" style="width:${spdPct}%"></div></div>
                    </div>
                </div>
            `;
            card.onclick = () => game.selectCharacter(char.id);
            grid.appendChild(card);
        }
        content.appendChild(grid);

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'menu-btn sel-back-btn';
        backBtn.innerHTML = `← RETOUR`;
        backBtn.onclick = () => game.setState(GameState.MAIN_MENU);
        content.appendChild(backBtn);

        this.el.appendChild(content);
        root.appendChild(this.el);
    }

    show(): void {
        this.el.classList.remove('hidden');
        this.bgStop = launchCanvasBg(this.el);
    }

    hide(): void {
        this.el.classList.add('hidden');
        this.bgStop?.();
        this.bgStop = null;
    }
}
