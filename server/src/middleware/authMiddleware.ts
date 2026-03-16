import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

export interface AuthRequest extends Request {
    userId?: number;
    username?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
    }

    try {
        const token = header.slice(7);
        const payload = authService.verifyToken(token);
        req.userId = payload.userId;
        req.username = payload.username;
        next();
    } catch {
        res.status(401).json({ error: 'Token invalide' });
    }
}
