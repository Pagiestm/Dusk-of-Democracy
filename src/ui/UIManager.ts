import { GameState } from '../constants';
import type { Game } from '../core/Game';

import { MainMenuScreen }        from './screens/MainMenuScreen';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen';
import { WeaponSelectScreen }    from './screens/WeaponSelectScreen';
import { HUDScreen }             from './screens/HUDScreen';
import { LevelUpScreen }         from './screens/LevelUpScreen';
import { PauseScreen }           from './screens/PauseScreen';
import { WaveEndScreen }         from './screens/WaveEndScreen';
import { GameOverScreen }        from './screens/GameOverScreen';

export class UIManager {
    private game: Game;

    private mainMenu:     MainMenuScreen;
    private charSelect:   CharacterSelectScreen;
    private weaponSelect: WeaponSelectScreen;
    private hud:          HUDScreen;
    private levelUp:      LevelUpScreen;
    private pause:        PauseScreen;
    private waveEnd:      WaveEndScreen;
    private gameOver:     GameOverScreen;

    constructor(game: Game) {
        this.game = game;
        const root = document.getElementById('ui-root')!;

        this.mainMenu     = new MainMenuScreen(game, root);
        this.charSelect   = new CharacterSelectScreen(game, root);
        this.weaponSelect = new WeaponSelectScreen(game, root);
        this.hud          = new HUDScreen(game, root);
        this.levelUp      = new LevelUpScreen(game, root);
        this.pause        = new PauseScreen(game, root);
        this.waveEnd      = new WaveEndScreen(game, root);
        this.gameOver     = new GameOverScreen(game, root);
    }

    // ─── State Management ─────────────────────────────────────────────────────

    onStateChange(oldState: GameState, newState: GameState): void {
        // Stop animated backgrounds when leaving those screens
        if (oldState === GameState.MAIN_MENU)       this.mainMenu.hide();
        if (oldState === GameState.CHARACTER_SELECT) this.charSelect.hide();
        if (oldState === GameState.WEAPON_SELECT)    this.weaponSelect.hide();

        this.hideAll();

        switch (newState) {
            case GameState.MAIN_MENU:
                this.mainMenu.show();
                break;
            case GameState.CHARACTER_SELECT:
                this.charSelect.show();
                break;
            case GameState.WEAPON_SELECT:
                this.weaponSelect.show();
                break;
            case GameState.PLAYING:
                this.hud.show();
                break;
            case GameState.PAUSED:
                this.hud.show();
                this.pause.show();
                break;
            case GameState.WAVE_END:
                this.hud.show();
                this.waveEnd.show();
                break;
            case GameState.LEVEL_UP:
                this.hud.show();
                this.levelUp.show();
                break;
            case GameState.GAME_OVER:
                this.gameOver.show();
                break;
        }
    }

    // ─── HUD ──────────────────────────────────────────────────────────────────

    updateHUD(): void {
        this.hud.update();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private hideAll(): void {
        this.mainMenu.hide();
        this.charSelect.hide();
        this.weaponSelect.hide();
        this.hud.hide();
        this.levelUp.hide();
        this.pause.hide();
        this.waveEnd.hide();
        this.gameOver.hide();
    }
}
