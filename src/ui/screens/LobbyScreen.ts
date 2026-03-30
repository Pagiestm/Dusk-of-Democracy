import { GameState } from '../../constants';
import type { Game } from '../../core/Game';

export class LobbyScreen {
    readonly el: HTMLElement;
    private contentEl: HTMLElement;
    private inRoom = false;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'lobby-screen hidden';

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'lobby-content';
        this.el.appendChild(this.contentEl);

        root.appendChild(this.el);
    }

    show(): void {
        this.el.classList.remove('hidden');
        this.inRoom = !!this.game.network.roomId;

        this.game.network.onRoomUpdated = () => this.renderRoom();
        this.game.network.onError = (msg) => this.showError(msg);

        if (this.inRoom) {
            this.renderRoom();
        } else {
            this.renderConnectForm();
        }
    }

    hide(): void {
        this.el.classList.add('hidden');
        this.game.network.onRoomUpdated = null;
        this.game.network.onError = null;
    }

    private renderConnectForm(): void {
        const net = this.game.network;

        this.contentEl.innerHTML = `
            <div class="lobby-header">
                <div class="lobby-title">MULTIJOUEUR</div>
            </div>

            <div class="lobby-form">
                <div class="lobby-field">
                    <label>Ton pseudo</label>
                    <input type="text" class="lobby-name-input" placeholder="Entrer un pseudo..." maxlength="16"
                           value="${net.playerName || ''}" />
                </div>

                <button class="menu-btn menu-btn-primary lobby-btn-full lobby-create">CREER UN SALON</button>

                <div class="lobby-separator">— OU —</div>

                <div class="lobby-join-row">
                    <input type="text" class="lobby-code-input" placeholder="CODE" maxlength="4" />
                    <button class="menu-btn lobby-join">REJOINDRE</button>
                </div>

                <div class="lobby-error"></div>
            </div>

            <div class="lobby-bottom">
                <button class="menu-btn lobby-btn-full lobby-back">← RETOUR</button>
            </div>
        `;

        const nameInput = this.contentEl.querySelector('.lobby-name-input') as HTMLInputElement;
        const codeInput = this.contentEl.querySelector('.lobby-code-input') as HTMLInputElement;

        const ensureConnected = (callback: () => void) => {
            const name = nameInput.value.trim() || 'Joueur';
            if (!net.isConnected) {
                net.connect(name);
                const check = setInterval(() => {
                    if (net.isConnected) {
                        clearInterval(check);
                        callback();
                    }
                }, 100);
                setTimeout(() => clearInterval(check), 3000);
            } else {
                callback();
            }
        };

        this.contentEl.querySelector('.lobby-create')!.addEventListener('click', () => {
            ensureConnected(() => net.createRoom());
        });

        this.contentEl.querySelector('.lobby-join')!.addEventListener('click', () => {
            const code = codeInput.value.trim();
            if (code.length === 4) {
                ensureConnected(() => net.joinRoom(code));
            }
        });

        this.contentEl.querySelector('.lobby-back')!.addEventListener('click', () => {
            net.disconnect();
            this.game.isMultiplayerGame = false;
            this.game.setState(GameState.MAIN_MENU);
        });
    }

    private renderRoom(): void {
        const net = this.game.network;
        this.inRoom = true;

        this.contentEl.innerHTML = `
            <div class="lobby-header">
                <div class="lobby-title">SALON</div>
                <div class="lobby-code-display">Code d'invitation<strong>${net.roomCode}</strong></div>
            </div>

            <div class="lobby-players">
                <div class="lobby-section-title">JOUEURS (${net.roomPlayers.length}/4)</div>
                ${net.roomPlayers.map(p => `
                    <div class="lobby-player ${p.id === net.myId ? 'lobby-player-me' : ''}">
                        <span class="lobby-player-name">${p.isHost ? '★ ' : ''}${p.name}</span>
                        <span class="lobby-player-status">
                            ${p.isReady ? '✓ Pret' : 'En attente...'}
                        </span>
                    </div>
                `).join('')}
            </div>

            <div class="lobby-bottom">
                ${net.isHost && net.roomPlayers.length >= 2 ? `
                    <button class="menu-btn menu-btn-primary lobby-btn-full lobby-start">LANCER LA PARTIE</button>
                ` : ''}
                ${net.isHost && net.roomPlayers.length < 2 ? `
                    <div class="lobby-waiting">En attente d'un autre joueur...</div>
                ` : ''}
                ${!net.isHost ? `
                    <div class="lobby-waiting">En attente de l'hote...</div>
                ` : ''}
                <button class="menu-btn lobby-btn-full lobby-leave">QUITTER LE SALON</button>
            </div>
        `;

        const startBtn = this.contentEl.querySelector('.lobby-start');
        startBtn?.addEventListener('click', () => {
            net.startSelection();
        });

        this.contentEl.querySelector('.lobby-leave')!.addEventListener('click', () => {
            net.leaveRoom();
            this.inRoom = false;
            this.renderConnectForm();
        });
    }

    private showError(msg: string): void {
        const errEl = this.contentEl.querySelector('.lobby-error');
        if (errEl) errEl.textContent = msg;
    }
}
