import { GameState } from '../../constants';
import type { Game } from '../../core/Game';

export class PauseScreen {
    readonly el: HTMLElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'pause-screen hidden';
        this.el.innerHTML = `<h2>PAUSE</h2>`;

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

    show(): void { this.el.classList.remove('hidden'); }
    hide(): void { this.el.classList.add('hidden'); }
}
