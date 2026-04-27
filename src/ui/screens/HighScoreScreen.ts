import { GameState } from '../../constants';
import { HighScoreManager, HighScoreEntry } from '../../core/HighScoreManager';
import { CHARACTERS } from '../../data/characters';
import { WEAPONS } from '../../data/weapons';
import type { Game } from '../../core/Game';

export class HighScoreScreen {
    readonly el: HTMLElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'highscore-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.build();
        this.el.classList.remove('hidden');
    }

    hide(): void {
        this.el.classList.add('hidden');
    }

    private build(): void {
        this.el.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'highscore-content';

        const title = document.createElement('h2');
        title.className = 'highscore-title';
        title.textContent = 'MEILLEURS SCORES';
        wrap.appendChild(title);

        const sub = document.createElement('div');
        sub.className = 'highscore-sub';
        sub.textContent = 'TOP 10 — MODE SOLO';
        wrap.appendChild(sub);

        const entries = HighScoreManager.getAll();

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'highscore-empty';
            empty.textContent = 'Aucun score enregistré pour le moment. Lance une partie !';
            wrap.appendChild(empty);
        } else {
            const table = this.buildTable(entries);
            wrap.appendChild(table);
        }

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.className = 'highscore-actions';

        if (entries.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'menu-btn menu-btn-secondary';
            clearBtn.innerHTML = `<span class="menu-btn-icon">🗑</span> EFFACER`;
            clearBtn.onclick = () => {
                if (confirm('Effacer tous les scores ?')) {
                    HighScoreManager.clear();
                    this.build();
                }
            };
            btnRow.appendChild(clearBtn);
        }

        const backBtn = document.createElement('button');
        backBtn.className = 'menu-btn menu-btn-primary';
        backBtn.innerHTML = `<span class="menu-btn-icon">◀</span> RETOUR`;
        backBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        btnRow.appendChild(backBtn);

        wrap.appendChild(btnRow);
        this.el.appendChild(wrap);
    }

    private buildTable(entries: HighScoreEntry[]): HTMLElement {
        const table = document.createElement('div');
        table.className = 'highscore-table';

        const header = document.createElement('div');
        header.className = 'highscore-row highscore-header';
        header.innerHTML = `
            <span class="hs-rank">#</span>
            <span class="hs-score">SCORE</span>
            <span class="hs-wave">VAGUE</span>
            <span class="hs-kills">ELIM.</span>
            <span class="hs-time">TEMPS</span>
            <span class="hs-char">PERSO</span>
        `;
        table.appendChild(header);

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const row = document.createElement('div');
            row.className = 'highscore-row';
            if (i === 0) row.classList.add('hs-gold');
            else if (i === 1) row.classList.add('hs-silver');
            else if (i === 2) row.classList.add('hs-bronze');

            const charName = CHARACTERS.find(c => c.id === e.characterId)?.name ?? e.characterId;
            const weaponName = WEAPONS.find(w => w.id === e.weaponId)?.name ?? e.weaponId;

            row.innerHTML = `
                <span class="hs-rank">${i + 1}</span>
                <span class="hs-score">${e.score.toLocaleString()}</span>
                <span class="hs-wave">${e.wave}</span>
                <span class="hs-kills">${e.kills}</span>
                <span class="hs-time">${this.formatTime(e.time)}</span>
                <span class="hs-char" title="${weaponName}">${charName}</span>
            `;
            table.appendChild(row);
        }

        return table;
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
