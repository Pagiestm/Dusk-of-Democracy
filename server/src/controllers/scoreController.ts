import { Request, Response } from 'express';
import { scoreService } from '../services/scoreService.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

export const scoreController = {
    async getLeaderboard(_req: Request, res: Response): Promise<void> {
        try {
            const scores = await scoreService.getLeaderboard(20);
            res.json(scores);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    async getUserScores(req: AuthRequest, res: Response): Promise<void> {
        try {
            const scores = await scoreService.getUserScores(req.userId!, 10);
            res.json(scores);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },
};
