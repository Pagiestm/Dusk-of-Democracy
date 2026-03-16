import { GameState } from '../../constants';
import { CHARACTERS } from '../../data/characters';
import { WEAPONS } from '../../data/weapons';
import type { Game } from '../../core/Game';

export class LobbyScreen {
    readonly el: HTMLElement;
    private contentEl: HTMLElement;
    private isInRoom = false;

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
        this.isInRoom = !!this.game.network.roomId;

        // Setup callback for room updates
        this.game.network.onRoomUpdated = () => this.renderRoom();
        this.game.network.onError = (msg) => this.showError(msg);
        this.game.network.onGameStarting = (players) => {
            // Find this player's selections
            const me = players.find(p => p.userId === this.game.network.userId);
            if (me?.characterId && me?.weaponId) {
                this.game.isMultiplayerGame = true;
                this.game.startGame(me.characterId, me.weaponId);
            }
        };

        if (this.isInRoom) {
            this.renderRoom();
        } else {
            this.renderLobbyMenu();
        }
    }

    hide(): void {
        this.el.classList.add('hidden');
        this.game.network.onRoomUpdated = null;
        this.game.network.onError = null;
    }

    private renderLobbyMenu(): void {
        const net = this.game.network;
        this.contentEl.innerHTML = `
            <div class="lobby-header">
                <div class="lobby-title">MULTIJOUEUR</div>
                <div class="lobby-user">Connecté : <strong>${net.username}</strong></div>
            </div>
            <div class="lobby-actions">
                <button class="menu-btn menu-btn-primary lobby-create">CRÉER UN SALON</button>
                <div class="lobby-separator">— OU —</div>
                <div class="lobby-join-row">
                    <input type="text" class="lobby-code-input" placeholder="CODE" maxlength="4" />
                    <button class="menu-btn lobby-join">REJOINDRE</button>
                </div>
                <div class="lobby-error"></div>
            </div>
            <button class="menu-btn lobby-back">← RETOUR</button>
        `;

        this.contentEl.querySelector('.lobby-create')!.addEventListener('click', () => {
            net.createRoom('coop', 4);
        });

        const joinBtn = this.contentEl.querySelector('.lobby-join')!;
        const codeInput = this.contentEl.querySelector('.lobby-code-input') as HTMLInputElement;
        joinBtn.addEventListener('click', () => {
            const code = codeInput.value.trim();
            if (code.length === 4) {
                net.joinRoom(code);
            }
        });

        this.contentEl.querySelector('.lobby-back')!.addEventListener('click', () => {
            net.disconnect();
            this.game.setState(GameState.MAIN_MENU);
        });
    }

    private renderRoom(): void {
        const net = this.game.network;
        this.isInRoom = true;

        const me = net.roomPlayers.find(p => p.userId === net.userId);
        const allReady = net.roomPlayers.every(p => p.characterId && p.weaponId);

        this.contentEl.innerHTML = `
            <div class="lobby-header">
                <div class="lobby-title">SALON</div>
                <div class="lobby-code-display">Code : <strong>${net.roomCode}</strong></div>
            </div>

            <div class="lobby-players">
                <div class="lobby-section-title">JOUEURS (${net.roomPlayers.length}/4)</div>
                ${net.roomPlayers.map(p => `
                    <div class="lobby-player ${p.userId === net.userId ? 'lobby-player-me' : ''} ${!p.isConnected ? 'lobby-player-dc' : ''}">
                        <span class="lobby-player-name">${p.isHost ? '★ ' : ''}${p.username}</span>
                        <span class="lobby-player-status">
                            ${p.characterId && p.weaponId ? '✓ Prêt' : 'En attente...'}
                        </span>
                    </div>
                `).join('')}
            </div>

            <div class="lobby-selection">
                <div class="lobby-section-title">PERSONNAGE</div>
                <div class="lobby-char-grid">
                    ${CHARACTERS.map(c => `
                        <button class="lobby-char-btn ${me?.characterId === c.id ? 'selected' : ''}" data-id="${c.id}">
                            <div class="lobby-char-name">${c.name}</div>
                            <div class="lobby-char-stats">PV: ${c.hp} · VIT: ${c.speed}</div>
                        </button>
                    `).join('')}
                </div>

                <div class="lobby-section-title">ARME</div>
                <div class="lobby-weapon-grid">
                    ${WEAPONS.map(w => `
                        <button class="lobby-weapon-btn ${me?.weaponId === w.id ? 'selected' : ''}" data-id="${w.id}">
                            <div class="lobby-weapon-name">${w.name}</div>
                            <div class="lobby-weapon-stats">DMG: ${w.damage} · CD: ${w.cooldown}s</div>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="lobby-bottom">
                ${net.isHost ? `<button class="menu-btn menu-btn-primary lobby-start ${allReady ? '' : 'disabled'}"
                    ${allReady ? '' : 'disabled'}>LANCER LA PARTIE</button>` : ''}
                <button class="menu-btn lobby-leave">QUITTER LE SALON</button>
            </div>
        `;

        // Character selection
        this.contentEl.querySelectorAll('.lobby-char-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                net.selectCharacter(btn.getAttribute('data-id')!);
            });
        });

        // Weapon selection
        this.contentEl.querySelectorAll('.lobby-weapon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                net.selectWeapon(btn.getAttribute('data-id')!);
            });
        });

        // Start button (host only)
        const startBtn = this.contentEl.querySelector('.lobby-start');
        startBtn?.addEventListener('click', () => {
            if (allReady) net.startGame();
        });

        // Leave button
        this.contentEl.querySelector('.lobby-leave')!.addEventListener('click', () => {
            net.leaveRoom();
            this.isInRoom = false;
            this.renderLobbyMenu();
        });
    }

    private showError(msg: string): void {
        const errEl = this.contentEl.querySelector('.lobby-error');
        if (errEl) errEl.textContent = msg;
    }
}
