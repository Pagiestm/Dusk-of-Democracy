import { Request, Response } from 'express';
import { authService } from '../services/authService.js';

export const authController = {
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                res.status(400).json({ error: 'Champs requis: username, email, password' });
                return;
            }
            if (password.length < 6) {
                res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
                return;
            }

            const result = await authService.register(username, email, password);
            res.status(201).json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    },

    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Champs requis: email, password' });
                return;
            }

            const result = await authService.login(email, password);
            res.json(result);
        } catch (err: any) {
            res.status(401).json({ error: err.message });
        }
    },
};
