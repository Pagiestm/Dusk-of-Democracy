import { GameState } from '../../constants';
import type { Game } from '../../core/Game';

export class GameOverScreen {
    readonly el: HTMLElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'game-over-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.buildStats();
        this.el.classList.remove('hidden');
    }

    hide(): void { this.el.classList.add('hidden'); }

    private buildStats(): void {
        this.el.innerHTML = '';

        const time = this.formatTime(this.game.getGameTime());

        const stats = document.createElement('div');
        stats.innerHTML = `
            <h2>DEFAITE</h2>
            <div class="stats-list">
                <div>Temps survecu : ${time}</div>
                <div>Niveau atteint : ${this.game.getLevel()}</div>
                <div>Ennemis elimines : ${this.game.getKillCount()}</div>
                <div>Vague atteinte : ${this.game.getWave()}</div>
                <div style="color:#f7c948;">Or gagne : ${this.game.getGold()}</div>
            </div>
        `;
        this.el.appendChild(stats);

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn';
        retryBtn.textContent = 'REESSAYER';
        retryBtn.onclick = () => {
            const char   = this.game.selectedCharacter;
            const weapon = this.game.selectedWeaponId;
            if (char && weapon) this.game.startGame(char.id, weapon);
        };
        this.el.appendChild(retryBtn);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'btn btn-secondary';
        menuBtn.textContent = 'MENU PRINCIPAL';
        menuBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.el.appendChild(menuBtn);
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
