import { v4 as uuidv4 } from 'uuid';
import { GameSession } from '../models/GameSession.js';

export const sessionService = {
    async createSession(hostUserId: number, mode: 'solo' | 'coop', maxPlayers: number) {
        const id = uuidv4();
        await GameSession.create(id, hostUserId, mode, maxPlayers);
        await GameSession.addPlayer(id, hostUserId, true);
        return { id };
    },

    async startSession(sessionId: string) {
        await GameSession.start(sessionId);
    },

    async finishSession(sessionId: string, finalWave: number, finalTime: number) {
        await GameSession.finish(sessionId, finalWave, finalTime);
    },

    async joinSession(sessionId: string, userId: number) {
        await GameSession.addPlayer(sessionId, userId, false);
    },

    async getSession(sessionId: string) {
        return GameSession.findById(sessionId);
    },
};
