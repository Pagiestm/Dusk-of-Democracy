import { Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

export const sessionController = {
    async create(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { mode, maxPlayers } = req.body;
            const result = await sessionService.createSession(
                req.userId!,
                mode || 'solo',
                maxPlayers || 4
            );
            res.status(201).json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    async get(req: AuthRequest, res: Response): Promise<void> {
        try {
            const session = await sessionService.getSession(req.params.id);
            if (!session) {
                res.status(404).json({ error: 'Session non trouvée' });
                return;
            }
            res.json(session);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },
};
