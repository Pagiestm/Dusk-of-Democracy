import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export interface TokenPayload {
    userId: number;
    username: string;
}

export const authService = {
    async register(username: string, email: string, password: string) {
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) throw new Error('Email déjà utilisé');

        const existingUsername = await User.findByUsername(username);
        if (existingUsername) throw new Error('Nom d\'utilisateur déjà pris');

        const passwordHash = await bcrypt.hash(password, 12);
        const userId = await User.create(username, email, passwordHash);

        const token = this.generateToken({ userId, username });
        return { userId, token };
    },

    async login(email: string, password: string) {
        const user = await User.findByEmail(email);
        if (!user) throw new Error('Identifiants invalides');

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new Error('Identifiants invalides');

        const token = this.generateToken({ userId: user.id, username: user.username });
        return { userId: user.id, username: user.username, token };
    },

    generateToken(payload: TokenPayload): string {
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' } as jwt.SignOptions);
    },

    verifyToken(token: string): TokenPayload {
        return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    },
};
