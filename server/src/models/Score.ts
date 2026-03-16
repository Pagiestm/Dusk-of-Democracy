import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ScoreRow {
    id: number;
    session_id: string;
    user_id: number;
    character_id: string;
    weapon_id: string;
    kills: number;
    wave_reached: number;
    time_survived: number;
    level_reached: number;
    gold_earned: number;
    created_at: Date;
    username?: string;
}

export const Score = {
    async create(
        sessionId: string,
        userId: number,
        characterId: string,
        weaponId: string,
        kills: number,
        waveReached: number,
        timeSurvived: number,
        levelReached: number,
        goldEarned: number
    ): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO scores
                (session_id, user_id, character_id, weapon_id, kills, wave_reached, time_survived, level_reached, gold_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, userId, characterId, weaponId, kills, waveReached, timeSurvived, levelReached, goldEarned]
        );
        return result.insertId;
    },

    async getLeaderboard(limit = 20): Promise<ScoreRow[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT s.*, u.username
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.wave_reached DESC, s.time_survived DESC
            LIMIT ?`,
            [limit]
        );
        return rows as ScoreRow[];
    },

    async getUserScores(userId: number, limit = 10): Promise<ScoreRow[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );
        return rows as ScoreRow[];
    },
};
