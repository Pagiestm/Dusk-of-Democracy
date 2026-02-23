import { GameState } from '../../constants';
import { launchCanvasBg } from '../shared/canvasBackground';
import type { Game } from '../../core/Game';

export class MainMenuScreen {
    readonly el: HTMLElement;
    private bgStop: (() => void) | null = null;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'main-menu hidden';

        // Canvas background
        const canvas = document.createElement('canvas');
        canvas.className = 'menu-canvas';
        this.el.appendChild(canvas);
        (this.el as any).__canvas = canvas;

        // Dark overlay
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay';
        this.el.appendChild(overlay);

        // Content
        const content = document.createElement('div');
        content.className = 'menu-content';

        // Logo / title
        const logoWrap = document.createElement('div');
        logoWrap.className = 'menu-logo-wrap';
        logoWrap.innerHTML = `
            <div class="menu-eyebrow">— SURVIVRE OU DISPARAÎTRE —</div>
            <div class="menu-title-top">DUSK OF</div>
            <div class="menu-title-main">DEMOCRACY</div>
            <div class="menu-title-rule"></div>
            <div class="menu-title-sub">Quand la démocratie tombe, le chaos se lève</div>
        `;
        content.appendChild(logoWrap);

        // Buttons
        const btnGroup = document.createElement('div');
        btnGroup.className = 'menu-btn-group';

        const playBtn = document.createElement('button');
        playBtn.className = 'menu-btn menu-btn-primary';
        playBtn.innerHTML = `<span class="menu-btn-arrow">▶</span> JOUER`;
        playBtn.onclick = () => game.setState(GameState.CHARACTER_SELECT);
        btnGroup.appendChild(playBtn);
        content.appendChild(btnGroup);

        // Version tag
        const ver = document.createElement('div');
        ver.className = 'menu-version';
        ver.textContent = 'VERSION ALPHA · 2026';
        content.appendChild(ver);

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
