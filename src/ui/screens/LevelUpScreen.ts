import type { Game } from '../../core/Game';

export class LevelUpScreen {
    readonly el: HTMLElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'level-up-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.buildChoices();
        this.el.classList.remove('hidden');
    }

    hide(): void { this.el.classList.add('hidden'); }

    private buildChoices(): void {
        this.el.innerHTML = `<h2>NIVEAU SUPERIEUR !</h2>`;

        const cards = document.createElement('div');
        cards.className = 'upgrade-cards';

        for (const upgrade of this.game.upgradeSystem.getRandomUpgrades(3)) {
            const level = this.game.upgradeSystem.getUpgradeLevel(upgrade.id);
            const card  = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                <p style="color:#888;font-size:11px;margin-top:8px;">Niveau ${level + 1}/${upgrade.maxLevel}</p>
            `;
            card.onclick = () => this.game.selectUpgrade(upgrade.id);
            cards.appendChild(card);
        }

        this.el.appendChild(cards);
    }
}
