import type { Game } from '../../core/Game';

export class HUDScreen {
    readonly el: HTMLElement;

    private hpBar:          HTMLElement | null = null;
    private hpLabel:        HTMLElement | null = null;
    private armorContainer: HTMLElement | null = null;
    private armorBar:       HTMLElement | null = null;
    private armorLabel:     HTMLElement | null = null;
    private xpBar:          HTMLElement | null = null;
    private xpLabel:        HTMLElement | null = null;
    private waveDisplay:    HTMLElement | null = null;
    private levelDisplay:   HTMLElement | null = null;
    private dayNightDisplay:HTMLElement | null = null;
    private timerDisplay:   HTMLElement | null = null;
    private killDisplay:    HTMLElement | null = null;
    private goldDisplay:    HTMLElement | null = null;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'hud hidden';

        // Left: HP + XP bars
        const left = document.createElement('div');
        left.className = 'hud-left';

        const hpContainer = document.createElement('div');
        hpContainer.className = 'bar-container hp-bar';
        this.hpBar = document.createElement('div');
        this.hpBar.className = 'bar-fill';
        this.hpBar.style.width = '100%';
        hpContainer.appendChild(this.hpBar);
        this.hpLabel = document.createElement('div');
        this.hpLabel.className = 'bar-label';
        this.hpLabel.textContent = '100/100';
        hpContainer.appendChild(this.hpLabel);
        left.appendChild(hpContainer);

        // Armor Bar
        this.armorContainer = document.createElement('div');
        this.armorContainer.className = 'bar-container armor-bar';
        this.armorContainer.style.display = 'none';
        this.armorBar = document.createElement('div');
        this.armorBar.className = 'bar-fill';
        this.armorBar.style.width = '0%';
        this.armorContainer.appendChild(this.armorBar);
        this.armorLabel = document.createElement('div');
        this.armorLabel.className = 'bar-label';
        this.armorLabel.textContent = '0';
        this.armorContainer.appendChild(this.armorLabel);
        left.appendChild(this.armorContainer);

        const xpContainer = document.createElement('div');
        xpContainer.className = 'bar-container xp-bar';
        this.xpBar = document.createElement('div');
        this.xpBar.className = 'bar-fill';
        this.xpBar.style.width = '0%';
        xpContainer.appendChild(this.xpBar);
        this.xpLabel = document.createElement('div');
        this.xpLabel.className = 'bar-label';
        this.xpLabel.textContent = 'NIV 1';
        xpContainer.appendChild(this.xpLabel);
        left.appendChild(xpContainer);

        // Center: Wave + Level
        const center = document.createElement('div');
        center.className = 'hud-center';
        this.waveDisplay = document.createElement('div');
        this.waveDisplay.className = 'wave-display';
        this.waveDisplay.textContent = 'Vague 1';
        center.appendChild(this.waveDisplay);
        this.levelDisplay = document.createElement('div');
        this.levelDisplay.className = 'level-display';
        this.levelDisplay.textContent = 'Niveau 1';
        center.appendChild(this.levelDisplay);

        // Right: Timer, Kills, Gold, Day/Night
        const right = document.createElement('div');
        right.className = 'hud-right';

        this.timerDisplay = document.createElement('div');
        this.timerDisplay.textContent = '00:00';

        this.killDisplay = document.createElement('div');
        this.killDisplay.textContent = 'Eliminations: 0';

        this.goldDisplay = document.createElement('div');
        this.goldDisplay.style.color = '#f7c948';
        this.goldDisplay.textContent = 'Or: 0';

        this.dayNightDisplay = document.createElement('div');
        this.dayNightDisplay.className = 'day-night-display day';
        this.dayNightDisplay.textContent = '☀️ JOUR';

        right.appendChild(this.timerDisplay);
        right.appendChild(this.killDisplay);
        right.appendChild(this.goldDisplay);
        right.appendChild(this.dayNightDisplay);

        this.el.appendChild(left);
        this.el.appendChild(center);
        this.el.appendChild(right);
        root.appendChild(this.el);
    }

    show(): void { this.el.classList.remove('hidden'); }
    hide(): void { this.el.classList.add('hidden'); }

    update(): void {
        const game = this.game;

        if (this.hpBar) {
            this.hpBar.style.width = `${(game.getHP() / game.getMaxHP()) * 100}%`;
        }
        if (this.hpLabel) {
            this.hpLabel.textContent = `${Math.ceil(game.getHP())}/${game.getMaxHP()}`;
        }
        if (this.armorContainer && this.armorBar && this.armorLabel) {
            const armor = game.getArmor();
            const maxArmor = game.getMaxArmor();
            if (armor > 0 && maxArmor > 0) {
                this.armorContainer.style.display = 'block';
                this.armorBar.style.width = `${(armor / maxArmor) * 100}%`;
                this.armorLabel.textContent = `${Math.ceil(armor)}/${maxArmor}`;
            } else {
                this.armorContainer.style.display = 'none';
            }
        }
        if (this.xpBar) {
            this.xpBar.style.width = `${game.getXPProgress() * 100}%`;
        }
        if (this.xpLabel) {
            this.xpLabel.textContent = `NIV ${game.getLevel()}`;
        }
        if (this.waveDisplay) {
            this.waveDisplay.textContent = `Vague ${game.getWave()}`;
        }
        if (this.levelDisplay) {
            this.levelDisplay.textContent = `Niveau ${game.getLevel()}`;
        }
        if (this.timerDisplay) {
            this.timerDisplay.textContent = this.formatTime(game.getGameTime());
        }
        if (this.killDisplay) {
            this.killDisplay.textContent = `Eliminations: ${game.getKillCount()}`;
        }
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `Or: ${game.getGold()}`;
        }
        if (this.dayNightDisplay) {
            const nf: number = (game.app as any).__nightFactor ?? 0;
            const t:  number = (game.app as any).__timeOfDay  ?? 0;
            let icon: string; let label: string; let cls: string;
            if (nf >= 0.85) {
                icon = '🌙'; label = 'NUIT'; cls = 'night';
            } else if (nf >= 0.15) {
                if (t < 0.7) { icon = '🌅'; label = 'CRÉPUSCULE'; cls = 'dusk'; }
                else         { icon = '🌄'; label = 'AUBE';        cls = 'dawn'; }
            } else {
                icon = '☀️'; label = 'JOUR'; cls = 'day';
            }
            if (!this.dayNightDisplay.classList.contains(cls)) {
                this.dayNightDisplay.className = `day-night-display ${cls}`;
            }
            this.dayNightDisplay.textContent = `${icon} ${label}`;
        }
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
