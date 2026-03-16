import { Response } from 'express';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

export const userController = {
    async getProfile(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user = await User.findById(req.userId!);
            if (!user) {
                res.status(404).json({ error: 'Utilisateur non trouvé' });
                return;
            }

            const { password_hash, ...profile } = user;
            res.json(profile);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },
};
