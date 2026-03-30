import type { Game } from '../../core/Game';

export class LevelUpScreen {
    readonly el: HTMLElement;
    private hasChosen = false;
    private refreshInterval: number | null = null;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'level-up-screen hidden';
        root.appendChild(this.el);
    }

    show(): void {
        this.hasChosen = false;
        this.buildChoices();
        this.el.classList.remove('hidden');

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

    private buildChoices(): void {
        this.el.innerHTML = `<h2>NIVEAU SUPERIEUR !</h2>`;

        if (!this.hasChosen) {
            // Phase 1: show upgrade cards
            const cards = document.createElement('div');
            cards.className = 'upgrade-cards';

            for (const upgrade of this.game.upgradeSystem.getRandomUpgrades(3)) {
                const level = this.game.upgradeSystem.getUpgradeLevel(upgrade.id);
                const card = document.createElement('div');
                card.className = 'upgrade-card';
                card.innerHTML = `
                    <h3>${upgrade.name}</h3>
                    <p>${upgrade.description}</p>
                    <p style="color:#888;font-size:11px;margin-top:8px;">Niveau ${level + 1}/${upgrade.maxLevel}</p>
                `;
                card.onclick = () => {
                    this.game.selectUpgrade(upgrade.id);
                    this.hasChosen = true;
                    if (this.game.isMultiplayerGame) {
                        this.buildChoices(); // Rebuild to show ready UI
                    }
                    // Solo: selectUpgrade already resumes the game
                };
                cards.appendChild(card);
            }
            this.el.appendChild(cards);
        } else {
            // Phase 2 (multi only): show ready section
            const chosenMsg = document.createElement('div');
            chosenMsg.className = 'level-up-chosen';
            chosenMsg.textContent = 'Amelioration appliquee !';
            this.el.appendChild(chosenMsg);

            // Ready status section
            const readySection = document.createElement('div');
            readySection.className = 'ready-section';
            readySection.id = 'levelup-ready-section';

            const readyTitle = document.createElement('div');
            readyTitle.className = 'ready-title';
            const readyCount = this.game.getReadyCount();
            const totalCount = this.game.getTotalPlayerCount();
            readyTitle.textContent = `JOUEURS PRETS : ${readyCount} / ${totalCount}`;
            readySection.appendChild(readyTitle);

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

            if (!this.game.isSelfReady()) {
                const readyBtn = document.createElement('button');
                readyBtn.className = 'btn btn-ready';
                readyBtn.textContent = 'PRET !';
                readyBtn.onclick = () => {
                    this.game.confirmLevelUp();
                    this.buildChoices(); // Rebuild to show waiting state
                };
                this.el.appendChild(readyBtn);
            } else {
                const waitingMsg = document.createElement('div');
                waitingMsg.className = 'ready-waiting-msg';
                waitingMsg.textContent = 'En attente des autres joueurs...';
                this.el.appendChild(waitingMsg);
            }
        }
    }

    private refreshReadyStatus(): void {
        const section = document.getElementById('levelup-ready-section');
        if (!section) return;

        const readyCount = this.game.getReadyCount();
        const totalCount = this.game.getTotalPlayerCount();

        const titleEl = section.querySelector('.ready-title');
        if (titleEl) {
            titleEl.textContent = `JOUEURS PRETS : ${readyCount} / ${totalCount}`;
        }

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
