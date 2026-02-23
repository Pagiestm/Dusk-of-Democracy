import type { Game } from '../../core/Game';

export class WaveEndScreen {
    readonly el: HTMLElement;
    private hasBoughtThisWave = false;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'wave-end-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.hasBoughtThisWave = false;
        this.buildShop();
        this.el.classList.remove('hidden');
    }

    hide(): void { this.el.classList.add('hidden'); }

    private buildShop(): void {
        this.el.innerHTML = '';

        const title = document.createElement('h2');
        title.textContent = `VAGUE ${this.game.getWave()} TERMINEE !`;
        this.el.appendChild(title);

        // Shop section
        const shopSection = document.createElement('div');
        shopSection.className = 'shop-section';

        const shopTitle = document.createElement('h3');
        shopTitle.className = 'shop-title';
        shopTitle.textContent = 'BOUTIQUE';
        shopSection.appendChild(shopTitle);

        const goldLabel = document.createElement('div');
        goldLabel.className = 'shop-gold';
        goldLabel.textContent = `Or disponible : ${this.game.getGold()}`;
        shopSection.appendChild(goldLabel);

        const shopGrid = document.createElement('div');
        shopGrid.className = 'shop-grid';

        for (const item of this.game.shopSystem.getItems()) {
            const canBuy = this.game.shopSystem.canBuy(item.id) && !this.hasBoughtThisWave;
            const card   = document.createElement('div');
            card.className = `shop-item ${canBuy ? '' : 'shop-item-disabled'}`;
            card.innerHTML = `
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.description}</div>
                <div class="shop-item-cost">${item.cost} Or</div>
            `;
            if (canBuy) {
                card.onclick = () => {
                    if (this.game.buyItem(item.id)) {
                        this.hasBoughtThisWave = true;
                        this.game.continueToNextWave();
                    }
                };
            }
            shopGrid.appendChild(card);
        }

        shopSection.appendChild(shopGrid);
        this.el.appendChild(shopSection);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn';
        nextBtn.textContent = 'VAGUE SUIVANTE';
        nextBtn.onclick = () => this.game.continueToNextWave();
        this.el.appendChild(nextBtn);
    }
}
