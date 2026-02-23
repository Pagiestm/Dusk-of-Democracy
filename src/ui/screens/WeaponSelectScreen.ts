import { GameState } from '../../constants';
import { WEAPONS } from '../../data/weapons';
import { launchCanvasBg } from '../shared/canvasBackground';
import type { Game } from '../../core/Game';

const PATTERN_META: Record<string, { label: string; icon: string; color: string }> = {
    single: { label: 'Tir unique', icon: '🎯', color: '#44aaff' },
    spread: { label: 'Dispersion', icon: '🌀', color: '#44cc88' },
    area:   { label: 'Zone',       icon: '💥', color: '#ff6b35' },
    orbit:  { label: 'Orbite',     icon: '🔄', color: '#cc44ff' },
};

export class WeaponSelectScreen {
    readonly el: HTMLElement;
    private wrapper: HTMLElement;
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

        // Dynamic content wrapper — rebuilt on each show()
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'sel-dynamic-content';
        this.el.appendChild(this.wrapper);

        root.appendChild(this.el);
    }

    show(): void {
        this.buildContent();
        this.el.classList.remove('hidden');
        this.bgStop = launchCanvasBg(this.el);
    }

    hide(): void {
        this.el.classList.add('hidden');
        this.bgStop?.();
        this.bgStop = null;
    }

    private buildContent(): void {
        this.wrapper.innerHTML = '';
        const char = this.game.selectedCharacter;

        const content = document.createElement('div');
        content.className = 'sel-content';

        // Header with character banner
        const header = document.createElement('div');
        header.className = 'sel-header';

        let bannerHtml = '';
        if (char) {
            const r = Math.floor(char.color.r * 255);
            const g = Math.floor(char.color.g * 255);
            const b = Math.floor(char.color.b * 255);
            bannerHtml = `
                <div class="sel-char-banner">
                    <div class="sel-banner-avatar" style="
                        background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.28), transparent 60%),
                                    rgb(${r},${g},${b});
                        box-shadow: 0 0 18px rgba(${r},${g},${b},0.55);"></div>
                    <div class="sel-banner-info">
                        <strong>${char.name}</strong>
                        <span>♥ ${char.hp} &nbsp;·&nbsp; ⚡ ${char.speed}</span>
                    </div>
                </div>
            `;
        }

        header.innerHTML = `
            ${bannerHtml}
            <div class="sel-step">ÉTAPE 2 · 2</div>
            <h2 class="sel-title">Choisis ton arme</h2>
            <div class="sel-rule"></div>
        `;
        content.appendChild(header);

        // Weapon grid
        const grid = document.createElement('div');
        grid.className = 'sel-weapon-grid';

        for (const weapon of WEAPONS) {
            const meta = PATTERN_META[weapon.pattern] ?? { label: weapon.pattern, icon: '⚡', color: '#fff' };
            const singleDps = Math.round(weapon.damage / weapon.cooldown);
            const totalDps  = weapon.spreadCount
                ? Math.round(weapon.damage * weapon.spreadCount / weapon.cooldown)
                : singleDps;
            const dpsLabel  = weapon.spreadCount ? `${singleDps} (${totalDps} total)` : `${singleDps}`;

            const card = document.createElement('div');
            card.className = 'sel-weapon-card';
            card.innerHTML = `
                <div class="sel-weapon-tag" style="color:${meta.color}">${meta.icon} ${meta.label}</div>
                <div class="sel-weapon-name">${weapon.name}</div>
                <p class="sel-weapon-desc">${weapon.description}</p>
                <div class="sel-weapon-stats">
                    <div class="sel-w-stat"><span class="sel-w-label">Dégâts</span><span class="sel-w-val">${weapon.damage}</span></div>
                    <div class="sel-w-stat"><span class="sel-w-label">Cadence</span><span class="sel-w-val">${weapon.cooldown}s</span></div>
                    <div class="sel-w-stat"><span class="sel-w-label">DPS</span><span class="sel-w-val">${dpsLabel}</span></div>
                </div>
            `;
            card.onclick = () => { if (char) this.game.startGame(char.id, weapon.id); };
            grid.appendChild(card);
        }
        content.appendChild(grid);

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'menu-btn sel-back-btn';
        backBtn.innerHTML = `← RETOUR`;
        backBtn.onclick = () => this.game.setState(GameState.CHARACTER_SELECT);
        content.appendChild(backBtn);

        this.wrapper.appendChild(content);
    }
}
