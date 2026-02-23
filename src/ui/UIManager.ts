import { GameState } from '../constants';
import { CHARACTERS } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import type { Game } from '../core/Game';

export class UIManager {
    private game: Game;
    private root: HTMLElement;

    // Screen elements
    private mainMenu: HTMLElement | null = null;
    private charSelect: HTMLElement | null = null;
    private weaponSelect: HTMLElement | null = null;
    private hud: HTMLElement | null = null;
    private levelUpScreen: HTMLElement | null = null;
    private pauseScreen: HTMLElement | null = null;
    private waveEndScreen: HTMLElement | null = null;
    private gameOverScreen: HTMLElement | null = null;

    // Shop state
    private hasBoughtThisWave: boolean = false;

    // HUD elements
    private hpBar: HTMLElement | null = null;
    private hpLabel: HTMLElement | null = null;
    private xpBar: HTMLElement | null = null;
    private xpLabel: HTMLElement | null = null;
    private waveDisplay: HTMLElement | null = null;
    private levelDisplay: HTMLElement | null = null;
    private dayNightDisplay: HTMLElement | null = null;
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
        this.createWeaponSelect();
        this.createHUD();
        this.createLevelUpScreen();
        this.createPauseScreen();
        this.createWaveEndScreen();
        this.createGameOverScreen();
    }

    // === Main Menu ===
    private createMainMenu(): void {
        this.mainMenu = document.createElement('div');
        this.mainMenu.className = 'main-menu hidden';
        this.mainMenu.innerHTML = `
            <h1>DUSK OF DEMOCRACY</h1>
            <p class="subtitle">Quand la democratie tombe, le chaos se leve</p>
        `;

        const playBtn = document.createElement('button');
        playBtn.className = 'btn';
        playBtn.textContent = 'JOUER';
        playBtn.onclick = () => this.game.setState(GameState.CHARACTER_SELECT);
        this.mainMenu.appendChild(playBtn);

        this.root.appendChild(this.mainMenu);
    }

    // === Character Select ===
    private createCharacterSelect(): void {
        this.charSelect = document.createElement('div');
        this.charSelect.className = 'character-select hidden';

        const title = document.createElement('h2');
        title.textContent = 'Choisis ton combattant';
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
            stats.textContent = `PV: ${char.hp} | Vitesse: ${char.speed}`;

            card.appendChild(avatar);
            card.appendChild(name);
            card.appendChild(desc);
            card.appendChild(stats);

            card.onclick = () => this.game.selectCharacter(char.id);
            grid.appendChild(card);
        }

        this.charSelect.appendChild(grid);

        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary';
        backBtn.textContent = 'RETOUR';
        backBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.charSelect.appendChild(backBtn);

        this.root.appendChild(this.charSelect);
    }

    // === Weapon Select ===
    private createWeaponSelect(): void {
        this.weaponSelect = document.createElement('div');
        this.weaponSelect.className = 'weapon-select hidden';
        this.root.appendChild(this.weaponSelect);
    }

    private showWeaponChoices(): void {
        if (!this.weaponSelect) return;
        this.weaponSelect.innerHTML = '';

        const char = this.game.selectedCharacter;

        const title = document.createElement('h2');
        title.textContent = 'Choisis ton arme';
        this.weaponSelect.appendChild(title);

        // Show selected character summary
        if (char) {
            const r = Math.floor(char.color.r * 255);
            const g = Math.floor(char.color.g * 255);
            const b = Math.floor(char.color.b * 255);
            const charBanner = document.createElement('div');
            charBanner.className = 'char-banner';
            charBanner.innerHTML = `
                <div class="char-banner-avatar" style="background: rgb(${r},${g},${b})"></div>
                <div class="char-banner-info">
                    <strong>${char.name}</strong>
                    <span>PV: ${char.hp} &nbsp;|&nbsp; Vitesse: ${char.speed}</span>
                </div>
            `;
            this.weaponSelect.appendChild(charBanner);
        }

        const grid = document.createElement('div');
        grid.className = 'weapon-grid';

        const patternMeta: Record<string, { label: string; icon: string; color: string }> = {
            single:  { label: 'Tir unique',   icon: '🎯', color: '#44aaff' },
            spread:  { label: 'Dispersion',   icon: '🌀', color: '#44cc88' },
            area:    { label: 'Zone',          icon: '💥', color: '#ff6b35' },
            orbit:   { label: 'Orbite',        icon: '🔄', color: '#cc44ff' },
        };

        for (const weapon of WEAPONS) {
            const meta = patternMeta[weapon.pattern] ?? { label: weapon.pattern, icon: '⚡', color: '#fff' };

            // Effective single-target DPS
            const singleDps = Math.round(weapon.damage / weapon.cooldown);
            const totalDps   = weapon.spreadCount
                ? Math.round(weapon.damage * weapon.spreadCount / weapon.cooldown)
                : singleDps;

            const dpsDisplay = weapon.spreadCount
                ? `${singleDps} (${totalDps} total)`
                : `${singleDps}`;

            const card = document.createElement('div');
            card.className = 'weapon-card';
            card.innerHTML = `
                <div class="weapon-pattern-tag" style="color: ${meta.color}">${meta.icon} ${meta.label}</div>
                <div class="weapon-name">${weapon.name}</div>
                <p class="weapon-desc">${weapon.description}</p>
                <div class="weapon-stats">
                    <div class="weapon-stat"><span class="stat-label">Dégâts</span><span class="stat-val">${weapon.damage}</span></div>
                    <div class="weapon-stat"><span class="stat-label">Cadence</span><span class="stat-val">${weapon.cooldown}s</span></div>
                    <div class="weapon-stat"><span class="stat-label">DPS</span><span class="stat-val">${dpsDisplay}</span></div>
                </div>
            `;
            card.onclick = () => {
                if (char) this.game.startGame(char.id, weapon.id);
            };
            grid.appendChild(card);
        }

        this.weaponSelect.appendChild(grid);

        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary';
        backBtn.textContent = 'RETOUR';
        backBtn.onclick = () => this.game.setState(GameState.CHARACTER_SELECT);
        this.weaponSelect.appendChild(backBtn);
    }
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
        this.xpLabel.textContent = 'NIV 1';
        xpContainer.appendChild(this.xpLabel);
        left.appendChild(xpContainer);

        // Center: Wave display
        const center = document.createElement('div');
        center.className = 'hud-center';
        this.waveDisplay = document.createElement('div');
        this.waveDisplay.className = 'wave-display';
        this.waveDisplay.textContent = 'Vague 1';
        center.appendChild(this.waveDisplay);
        this.levelDisplay = document.createElement('div');
        this.levelDisplay.className = 'level-display';
        this.levelDisplay.textContent = 'Niveau 1';
        center.appendChild(this.levelDisplay);

        // Right: Timer, Kills, Gold
        const right = document.createElement('div');
        right.className = 'hud-right';
        this.timerDisplay = document.createElement('div');
        this.timerDisplay.textContent = '00:00';
        this.killDisplay = document.createElement('div');
        this.killDisplay.textContent = 'Eliminations: 0';
        this.goldDisplay = document.createElement('div');
        this.goldDisplay.style.color = '#f7c948';
        this.goldDisplay.textContent = 'Or: 0';
        this.dayNightDisplay = document.createElement('div');
        this.dayNightDisplay.className = 'day-night-display day';
        this.dayNightDisplay.textContent = '☀️ JOUR';
        right.appendChild(this.timerDisplay);
        right.appendChild(this.killDisplay);
        right.appendChild(this.goldDisplay);
        right.appendChild(this.dayNightDisplay);

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

        this.levelUpScreen.innerHTML = `<h2>NIVEAU SUPERIEUR !</h2>`;

        const cards = document.createElement('div');
        cards.className = 'upgrade-cards';

        for (const upgrade of upgrades) {
            const card = document.createElement('div');
            card.className = 'upgrade-card';

            const level = this.game.upgradeSystem.getUpgradeLevel(upgrade.id);

            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                <p style="color: #888; font-size: 11px; margin-top: 8px;">Niveau ${level + 1}/${upgrade.maxLevel}</p>
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
        this.pauseScreen.innerHTML = `<h2>PAUSE</h2>`;

        const resumeBtn = document.createElement('button');
        resumeBtn.className = 'btn';
        resumeBtn.textContent = 'REPRENDRE';
        resumeBtn.onclick = () => this.game.resumeGame();
        this.pauseScreen.appendChild(resumeBtn);

        const quitBtn = document.createElement('button');
        quitBtn.className = 'btn btn-secondary';
        quitBtn.textContent = 'QUITTER';
        quitBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.pauseScreen.appendChild(quitBtn);

        this.root.appendChild(this.pauseScreen);
    }

    // === Wave End Screen (Boutique) ===
    private createWaveEndScreen(): void {
        this.waveEndScreen = document.createElement('div');
        this.waveEndScreen.className = 'wave-end-screen hidden';
        this.root.appendChild(this.waveEndScreen);
    }

    private showWaveEndShop(): void {
        if (!this.waveEndScreen) return;
        this.waveEndScreen.innerHTML = '';

        const title = document.createElement('h2');
        title.textContent = `VAGUE ${this.game.getWave()} TERMINEE !`;
        this.waveEndScreen.appendChild(title);

        // === Boutique ===
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
            const card = document.createElement('div');
            const canBuy = this.game.shopSystem.canBuy(item.id) && !this.hasBoughtThisWave;
            card.className = `shop-item ${canBuy ? '' : 'shop-item-disabled'}`;

            card.innerHTML = `
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.description}</div>
                <div class="shop-item-cost">${item.cost} Or</div>
            `;

            if (canBuy && !this.hasBoughtThisWave) {
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
        this.waveEndScreen.appendChild(shopSection);

        // Bouton vague suivante
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn';
        nextBtn.textContent = 'VAGUE SUIVANTE';
        nextBtn.onclick = () => this.game.continueToNextWave();
        this.waveEndScreen.appendChild(nextBtn);
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
            <h2>DEFAITE</h2>
            <div class="stats-list">
                <div>Temps survecu : ${time}</div>
                <div>Niveau atteint : ${this.game.getLevel()}</div>
                <div>Ennemis elimines : ${this.game.getKillCount()}</div>
                <div>Vague atteinte : ${this.game.getWave()}</div>
                <div style="color: #f7c948;">Or gagne : ${this.game.getGold()}</div>
            </div>
        `;

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn';
        retryBtn.textContent = 'REESSAYER';
        retryBtn.onclick = () => {
            if (this.game.selectedCharacter && this.game.selectedWeaponId) {
                this.game.startGame(this.game.selectedCharacter.id, this.game.selectedWeaponId);
            }
        };
        this.gameOverScreen.appendChild(retryBtn);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'btn btn-secondary';
        menuBtn.textContent = 'MENU PRINCIPAL';
        menuBtn.onclick = () => this.game.setState(GameState.MAIN_MENU);
        this.gameOverScreen.appendChild(menuBtn);
    }

    // === State Management ===
    onStateChange(oldState: GameState, newState: GameState): void {
        // Hide all screens
        this.mainMenu?.classList.add('hidden');
        this.charSelect?.classList.add('hidden');
        this.weaponSelect?.classList.add('hidden');
        this.hud?.classList.add('hidden');
        this.levelUpScreen?.classList.add('hidden');
        this.pauseScreen?.classList.add('hidden');
        this.waveEndScreen?.classList.add('hidden');
        this.gameOverScreen?.classList.add('hidden');

        // Show appropriate screen
        switch (newState) {
            case GameState.MAIN_MENU:
                this.mainMenu?.classList.remove('hidden');
                break;
            case GameState.CHARACTER_SELECT:
                this.charSelect?.classList.remove('hidden');
                break;
            case GameState.WEAPON_SELECT:
                this.showWeaponChoices();
                this.weaponSelect?.classList.remove('hidden');
                break;
            case GameState.PLAYING:
                this.hud?.classList.remove('hidden');
                break;
            case GameState.PAUSED:
                this.hud?.classList.remove('hidden');
                this.pauseScreen?.classList.remove('hidden');
                break;
            case GameState.WAVE_END:
                this.hud?.classList.remove('hidden');
                this.hasBoughtThisWave = false;
                this.showWaveEndShop();
                this.waveEndScreen?.classList.remove('hidden');
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
            this.xpLabel.textContent = `NIV ${this.game.getLevel()}`;
        }
        if (this.dayNightDisplay) {
            const nf: number = (this.game.app as any).__nightFactor ?? 0;
            const t: number  = (this.game.app as any).__timeOfDay ?? 0;
            let icon: string; let label: string; let cls: string;
            if (nf >= 0.85) {
                icon = '🌙'; label = 'NUIT'; cls = 'night';
            } else if (nf >= 0.15) {
                // transition : dusk si on descend, dawn si on monte
                if (t < 0.7) { icon = '🌅'; label = 'CRÉPUSCULE'; cls = 'dusk'; }
                else         { icon = '🌄'; label = 'AUBE'; cls = 'dawn'; }
            } else {
                icon = '☀️'; label = 'JOUR'; cls = 'day';
            }
            if (!this.dayNightDisplay.classList.contains(cls)) {
                this.dayNightDisplay.className = `day-night-display ${cls}`;
            }
            this.dayNightDisplay.textContent = `${icon} ${label}`;
        }
        if (this.waveDisplay) {
            this.waveDisplay.textContent = `Vague ${this.game.getWave()}`;
        }
        if (this.levelDisplay) {
            this.levelDisplay.textContent = `Niveau ${this.game.getLevel()}`;
        }
        if (this.timerDisplay) {
            this.timerDisplay.textContent = this.formatTime(this.game.getGameTime());
        }
        if (this.killDisplay) {
            this.killDisplay.textContent = `Eliminations: ${this.game.getKillCount()}`;
        }
        if (this.goldDisplay) {
            this.goldDisplay.textContent = `Or: ${this.game.getGold()}`;
        }
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
