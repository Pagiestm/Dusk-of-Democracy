import type { Game } from '../../core/Game';

export class WaveEndScreen {
    readonly el: HTMLElement;
    private hasBoughtThisWave = false;
    private isReady = false;
    private refreshInterval: number | null = null;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'wave-end-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.hasBoughtThisWave = false;
        this.isReady = false;
        this.buildShop();
        this.el.classList.remove('hidden');

        // In multiplayer, refresh the UI periodically to show ready status updates
        if (this.game.isMultiplayerGame) {
            this.refreshInterval = window.setInterval(() => this.refreshReadyStatus(), 500);
        }
    }

    hide(): void {
        this.el.classList.add('hidden');
        if (this.refreshInterval !== null) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    private buildShop(): void {
        this.el.innerHTML = '';

        const title = document.createElement('h2');
        title.textContent = `VAGUE ${this.game.completedWave} TERMINEE !`;
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
            const canBuy = this.game.shopSystem.canBuy(item.id) && !this.hasBoughtThisWave && !this.isReady;
            // For clients, check gold from snapshot
            const clientCanAfford = this.game.isClient
                ? this.game.getGold() >= item.cost && !this.hasBoughtThisWave && !this.isReady
                : canBuy;

            const card = document.createElement('div');
            card.className = `shop-item ${clientCanAfford ? '' : 'shop-item-disabled'}`;
            card.innerHTML = `
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.description}</div>
                <div class="shop-item-cost">${item.cost} Or</div>
            `;
            if (clientCanAfford) {
                card.onclick = () => {
                    this.game.buyItem(item.id);
                    this.hasBoughtThisWave = true;
                    this.buildShop(); // Rebuild to update UI
                };
            }
            shopGrid.appendChild(card);
        }

        shopSection.appendChild(shopGrid);
        this.el.appendChild(shopSection);

        // Multiplayer: ready system
        if (this.game.isMultiplayerGame) {
            // Ready status section
            const readySection = document.createElement('div');
            readySection.className = 'ready-section';
            readySection.id = 'ready-section';

            const readyTitle = document.createElement('div');
            readyTitle.className = 'ready-title';
            const readyCount = this.game.getReadyCount();
            const totalCount = this.game.getTotalPlayerCount();
            readyTitle.textContent = `JOUEURS PRETS : ${readyCount} / ${totalCount}`;
            readySection.appendChild(readyTitle);

            // Player ready list
            const playerList = document.createElement('div');
            playerList.className = 'ready-player-list';

            for (const p of this.game.network.roomPlayers) {
                const playerEl = document.createElement('div');
                const isReady = this.game.isPlayerReady(p.id);
                playerEl.className = `ready-player ${isReady ? 'ready-player-ready' : ''}`;
                playerEl.innerHTML = `
                    <span class="ready-player-name">${p.name}</span>
                    <span class="ready-player-status">${isReady ? '✓ PRET' : 'En attente...'}</span>
                `;
                playerList.appendChild(playerEl);
            }

            readySection.appendChild(playerList);
            this.el.appendChild(readySection);

            // Ready button
            if (!this.isReady) {
                const readyBtn = document.createElement('button');
                readyBtn.className = 'btn btn-ready';
                readyBtn.textContent = 'PRET !';
                readyBtn.onclick = () => {
                    this.isReady = true;
                    this.game.continueToNextWave();
                    this.buildShop(); // Rebuild to disable buy + show ready state
                };
                this.el.appendChild(readyBtn);
            } else {
                const waitingMsg = document.createElement('div');
                waitingMsg.className = 'ready-waiting-msg';
                waitingMsg.textContent = 'En attente des autres joueurs...';
                this.el.appendChild(waitingMsg);
            }
        } else {
            // Solo: direct next wave button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn';
            nextBtn.textContent = 'VAGUE SUIVANTE';
            nextBtn.onclick = () => this.game.continueToNextWave();
            this.el.appendChild(nextBtn);
        }
    }

    /** Periodically refresh ready status display in multiplayer */
    private refreshReadyStatus(): void {
        const section = document.getElementById('ready-section');
        if (!section) return;

        const readyCount = this.game.getReadyCount();
        const totalCount = this.game.getTotalPlayerCount();

        // Update title
        const titleEl = section.querySelector('.ready-title');
        if (titleEl) {
            titleEl.textContent = `JOUEURS PRETS : ${readyCount} / ${totalCount}`;
        }

        // Update each player status
        const playerEls = section.querySelectorAll('.ready-player');
        const players = this.game.network.roomPlayers;
        playerEls.forEach((el, i) => {
            if (i < players.length) {
                const isReady = this.game.isPlayerReady(players[i].id);
                el.className = `ready-player ${isReady ? 'ready-player-ready' : ''}`;
                const statusEl = el.querySelector('.ready-player-status');
                if (statusEl) {
                    statusEl.textContent = isReady ? '✓ PRET' : 'En attente...';
                }
            }
        });
    }
}
