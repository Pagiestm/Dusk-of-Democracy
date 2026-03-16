import { Score } from '../models/Score.js';
import { User } from '../models/User.js';
import { GameEndStats } from '../game/shared/types.js';

export const scoreService = {
    async submitScore(sessionId: string, userId: number, stats: GameEndStats) {
        const scoreId = await Score.create(
            sessionId,
            userId,
            stats.characterId,
            stats.weaponId,
            stats.kills,
            stats.waveReached,
            stats.timeSurvived,
            stats.levelReached,
            stats.goldEarned
        );

        // Update player aggregate stats
        await User.updateStats(userId, stats.kills, stats.waveReached, stats.timeSurvived);

        return scoreId;
    },

    async getLeaderboard(limit = 20) {
        return Score.getLeaderboard(limit);
    },

    async getUserScores(userId: number, limit = 10) {
        return Score.getUserScores(userId, limit);
    },
};
