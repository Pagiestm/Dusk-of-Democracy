import { GameState } from '../../constants';
import type { Game } from '../../core/Game';

export class LoginScreen {
    readonly el: HTMLElement;
    private errorEl: HTMLElement;

    constructor(private game: Game, root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.className = 'login-screen hidden';

        this.el.innerHTML = `
            <div class="login-overlay"></div>
            <div class="login-content">
                <div class="login-title">CONNEXION</div>

                <div class="login-tabs">
                    <button class="login-tab active" data-tab="login">Se connecter</button>
                    <button class="login-tab" data-tab="register">S'inscrire</button>
                </div>

                <form class="login-form" id="login-form">
                    <div class="login-field register-only hidden">
                        <label>Pseudo</label>
                        <input type="text" name="username" placeholder="Pseudo" autocomplete="username" />
                    </div>
                    <div class="login-field">
                        <label>Email</label>
                        <input type="email" name="email" placeholder="email@exemple.com" autocomplete="email" required />
                    </div>
                    <div class="login-field">
                        <label>Mot de passe</label>
                        <input type="password" name="password" placeholder="••••••" autocomplete="current-password" required />
                    </div>
                    <div class="login-error"></div>
                    <button type="submit" class="menu-btn menu-btn-primary login-submit">CONNEXION</button>
                </form>

                <button class="menu-btn login-back">← RETOUR</button>
            </div>
        `;

        this.errorEl = this.el.querySelector('.login-error')!;

        // Tab switching
        const tabs = this.el.querySelectorAll('.login-tab');
        const registerFields = this.el.querySelectorAll('.register-only');
        const submitBtn = this.el.querySelector('.login-submit') as HTMLButtonElement;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isRegister = tab.getAttribute('data-tab') === 'register';
                registerFields.forEach(f => f.classList.toggle('hidden', !isRegister));
                submitBtn.textContent = isRegister ? 'INSCRIPTION' : 'CONNEXION';
            });
        });

        // Form submit
        const form = this.el.querySelector('#login-form') as HTMLFormElement;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form);
        });

        // Back button
        this.el.querySelector('.login-back')!.addEventListener('click', () => {
            game.setState(GameState.MAIN_MENU);
        });

        root.appendChild(this.el);
    }

    private async handleSubmit(form: HTMLFormElement) {
        const data = new FormData(form);
        const email = data.get('email') as string;
        const password = data.get('password') as string;
        const username = data.get('username') as string;
        const isRegister = this.el.querySelector('.login-tab.active')?.getAttribute('data-tab') === 'register';

        this.errorEl.textContent = '';

        try {
            const net = this.game.network;
            if (isRegister) {
                if (!username || username.length < 2) {
                    this.errorEl.textContent = 'Pseudo requis (min 2 caractères)';
                    return;
                }
                await net.register(username, email, password);
            } else {
                await net.login(email, password);
            }

            // Connect WebSocket
            net.connect();

            // Go to lobby
            this.game.setState(GameState.LOBBY);
        } catch (err: any) {
            this.errorEl.textContent = err.message;
        }
    }

    show(): void { this.el.classList.remove('hidden'); }
    hide(): void { this.el.classList.add('hidden'); }
}
