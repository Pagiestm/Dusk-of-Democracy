import { GameState } from '../constants';
import { CHARACTERS } from '../data/characters';
import type { Game } from '../core/Game';

export class UIManager {
    private game: Game;
    private root: HTMLElement;

    // Screen elements
    private mainMenu: HTMLElement | null = null;
    private charSelect: HTMLElement | null = null;
    private hud: HTMLElement | null = null;
    private levelUpScreen: HTMLElement | null = null;
    private pauseScreen: HTMLElement | null = null;
    private gameOverScreen: HTMLElement | null = null;

    // HUD elements
    private hpBar: HTMLElement | null = null;
    private hpLabel: HTMLElement | null = null;
    private xpBar: HTMLElement | null = null;
    private xpLabel: HTMLElement | null = null;
    private waveDisplay: HTMLElement | null = null;
    private levelDisplay: HTMLElement | null = null;
    private timerDisplay: HTMLElement | null = null;
    private killDisplay: HTMLElement | null = null;
    private goldDisplay: HTMLElement | null = null;

    constructor(game: Game) {
        this.game = game;
        this.root = document.getElementById('ui-root')!;
        this.createScreens();
    }

    private createScreens(): void {
        this.createMainMenu();
        this.createCharacterSelect();
        this.createHUD();
        this.createLevelUpScreen();
        this.createPauseScreen();
        this.createGameOverScreen();
    }

    // === Main Menu ===
    private createMainMenu(): void {
        this.mainMenu = document.createElement('div');
        this.mainMenu.className = 'main-menu hidden';
        this.mainMenu.innerHTML = `
            <h1>DUSK OF DEMOCRACY</h1>
            <p class="subtitle">When Democracy Falls, Chaos Rises</p>
        `;

        const playBtn = document.createElement('button');
        playBtn.className = 'btn';
        playBtn.textContent = 'PLAY';
        playBtn.onclick = () => this.game.setState(GameState.CHARACTER_SELECT);
        this.mainMenu.appendChild(playBtn);

        this.root.appendChild(this.mainMenu);
    }

    // === Character Select ===
    private createCharacterSelect(): void {
        this.charSelect = document.createElement('div');
        this.charSelect.className = 'character-select hidden';

        const title = document.createElement('h2');
        title.textContent = 'Choose Your Fighter';
        this.charSelect.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'character-grid';

        for (const char of CHARACTERS) {
            const card = document.createElement('div');
            card.className = 'character-card';

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.background = `rgb(${Math.floor(char.color.r * 255)}, ${Math.floor(char.color.g * 255)}, ${Math.floor(char.color.b * 255)})`;

            const name = document.createElement('h3');
            name.textContent = char.name;

            const desc = document.createElement('p');
            desc.textContent = char.description;

            const stats = document.createElement('div');
            stats.className = 'stats';
            stats.textContent = `HP: ${char.hp} | Speed: ${char.speed}`;

            card.appendChild(avatar);
            card.appendChild(name);
            card.appendChild(desc);
            card.appendChild(stats);

            card.onclick = () => this.game.startGame(char.id);
            grid.appendChild(card);
        }

        this.charSelect.appendChild(grid);

        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary';
        backBtn.textContent = 'BACK';
        backBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.charSelect.appendChild(backBtn);

        this.root.appendChild(this.charSelect);
    }

    // === HUD ===
    private createHUD(): void {
        this.hud = document.createElement('div');
        this.hud.className = 'hud hidden';

        // Left: HP + XP bars
        const left = document.createElement('div');
        left.className = 'hud-left';

        // HP Bar
        const hpContainer = document.createElement('div');
        hpContainer.className = 'bar-container hp-bar';
        this.hpBar = document.createElement('div');
        this.hpBar.className = 'bar-fill';
        this.hpBar.style.width = '100%';
        hpContainer.appendChild(this.hpBar);
        this.hpLabel = document.createElement('div');
        this.hpLabel.className = 'bar-label';
        this.hpLabel.textContent = '100/100';
        hpContainer.appendChild(this.hpLabel);
        left.appendChild(hpContainer);

        // XP Bar
        const xpContainer = document.createElement('div');
        xpContainer.className = 'bar-container xp-bar';
        this.xpBar = document.createElement('div');
        this.xpBar.className = 'bar-fill';
        this.xpBar.style.width = '0%';
        xpContainer.appendChild(this.xpBar);
        this.xpLabel = document.createElement('div');
        this.xpLabel.className = 'bar-label';
        this.xpLabel.textContent = 'LVL 1';
        xpContainer.appendChild(this.xpLabel);
        left.appendChild(xpContainer);

        // Center: Wave display
        const center = document.createElement('div');
        center.className = 'hud-center';
        this.waveDisplay = document.createElement('div');
        this.waveDisplay.className = 'wave-display';
        this.waveDisplay.textContent = 'Wave 1';
        center.appendChild(this.waveDisplay);
        this.levelDisplay = document.createElement('div');
        this.levelDisplay.className = 'level-display';
        this.levelDisplay.textContent = 'Level 1';
        center.appendChild(this.levelDisplay);

        // Right: Timer, Kills, Gold
        const right = document.createElement('div');
        right.className = 'hud-right';
        this.timerDisplay = document.createElement('div');
        this.timerDisplay.textContent = '00:00';
        this.killDisplay = document.createElement('div');
        this.killDisplay.textContent = 'Kills: 0';
        this.goldDisplay = document.createElement('div');
        this.goldDisplay.style.color = '#f7c948';
        this.goldDisplay.textContent = 'Gold: 0';
        right.appendChild(this.timerDisplay);
        right.appendChild(this.killDisplay);
        right.appendChild(this.goldDisplay);

        this.hud.appendChild(left);
        this.hud.appendChild(center);
        this.hud.appendChild(right);
        this.root.appendChild(this.hud);
    }

    // === Level Up Screen ===
    private createLevelUpScreen(): void {
        this.levelUpScreen = document.createElement('div');
        this.levelUpScreen.className = 'level-up-screen hidden';
        this.root.appendChild(this.levelUpScreen);
    }

    private showLevelUpChoices(): void {
        if (!this.levelUpScreen) return;

        const upgrades = this.game.upgradeSystem.getRandomUpgrades(3);

        this.levelUpScreen.innerHTML = `<h2>LEVEL UP!</h2>`;

        const cards = document.createElement('div');
        cards.className = 'upgrade-cards';

        for (const upgrade of upgrades) {
            const card = document.createElement('div');
            card.className = 'upgrade-card';

            const level = this.game.upgradeSystem.getUpgradeLevel(upgrade.id);

            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                <p style="color: #888; font-size: 11px; margin-top: 8px;">Level ${level + 1}/${upgrade.maxLevel}</p>
            `;

            card.onclick = () => this.game.selectUpgrade(upgrade.id);
            cards.appendChild(card);
        }

        this.levelUpScreen.appendChild(cards);
    }

    // === Pause Screen ===
    private createPauseScreen(): void {
        this.pauseScreen = document.createElement('div');
        this.pauseScreen.className = 'pause-screen hidden';
        this.pauseScreen.innerHTML = `<h2>PAUSED</h2>`;

        const resumeBtn = document.createElement('button');
        resumeBtn.className = 'btn';
        resumeBtn.textContent = 'RESUME';
        resumeBtn.onclick = () => this.game.resumeGame();
        this.pauseScreen.appendChild(resumeBtn);

        const quitBtn = document.createElement('button');
        quitBtn.className = 'btn btn-secondary';
        quitBtn.textContent = 'QUIT TO MENU';
        quitBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.pauseScreen.appendChild(quitBtn);

        this.root.appendChild(this.pauseScreen);
    }

    // === Game Over ===
    private createGameOverScreen(): void {
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.className = 'game-over-screen hidden';
        this.root.appendChild(this.gameOverScreen);
    }

    private showGameOverStats(): void {
        if (!this.gameOverScreen) return;

        const time = this.formatTime(this.game.getGameTime());

        this.gameOverScreen.innerHTML = `
            <h2>GAME OVER</h2>
            <div class="stats-list">
                <div>Time Survived: ${time}</div>
                <div>Level Reached: ${this.game.getLevel()}</div>
                <div>Enemies Killed: ${this.game.getKillCount()}</div>
                <div>Wave Reached: ${this.game.getWave()}</div>
                <div style="color: #f7c948;">Gold Earned: ${this.game.getGold()}</div>
            </div>
        `;

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn';
        retryBtn.textContent = 'TRY AGAIN';
        retryBtn.onclick = () => {
            if (this.game.selectedCharacter) {
                this.game.startGame(this.game.selectedCharacter.id);
            }
        };
        this.gameOverScreen.appendChild(retryBtn);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'btn btn-secondary';
        menuBtn.textContent = 'MAIN MENU';
        menuBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.gameOverScreen.appendChild(menuBtn);
    }

    // === State Management ===
    onStateChange(oldState: GameState, newState: GameState): void {
        // Hide all screens
        this.mainMenu?.classList.add('hidden');
        this.charSelect?.classList.add('hidden');
        this.hud?.classList.add('hidden');
        this.levelUpScreen?.classList.add('hidden');
        this.pauseScreen?.classList.add('hidden');
        this.gameOverScreen?.classList.add('hidden');

        // Show appropriate screen
        switch (newState) {
            case GameState.MAIN_MENU:
                this.mainMenu?.classList.remove('hidden');
                break;
            case GameState.CHARACTER_SELECT:
                this.charSelect?.classList.remove('hidden');
                break;
            case GameState.PLAYING:
                this.hud?.classList.remove('hidden');
                break;
            case GameState.PAUSED:
                this.hud?.classList.remove('hidden');
                this.pauseScreen?.classList.remove('hidden');
                break;
            case GameState.LEVEL_UP:
                this.hud?.classList.remove('hidden');
                this.showLevelUpChoices();
                this.levelUpScreen?.classList.remove('hidden');
                break;
            case GameState.GAME_OVER:
                this.showGameOverStats();
                this.gameOverScreen?.classList.remove('hidden');
                break;
        }
    }

    // === HUD Update ===
    updateHUD(): void {
        if (this.hpBar) {
            const pct = (this.game.getHP() / this.game.getMaxHP()) * 100;
            this.hpBar.style.width = `${pct}%`;
        }
        if (this.hpLabel) {
            this.hpLabel.textContent = `${Math.ceil(this.game.getHP())}/${this.game.getMaxHP()}`;
        }
        if (this.xpBar) {
            this.xpBar.style.width = `${this.game.getXPProgress() * 100}%`;
        }
        if (this.xpLabel) {
            this.xpLabel.textContent = `LVL ${this.game.getLevel()}`;
        }
        if (this.waveDisplay) {
            this.waveDisplay.textContent = `Wave ${this.game.getWave()}`;
        }
        if (this.levelDisplay) {
            this.levelDisplay.textContent = `Level ${this.game.getLevel()}`;
        }
        if (this.timerDisplay) {
            this.timerDisplay.textContent = this.formatTime(this.game.getGameTime());
        }
        if (this.killDisplay) {
            this.killDisplay.textContent = `Kills: ${this.game.getKillCount()}`;
        }
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `Gold: ${this.game.getGold()}`;
        }
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
