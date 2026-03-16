import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface GameSessionRow {
    id: string;
    host_user_id: number;
    mode: 'solo' | 'coop';
    status: 'lobby' | 'playing' | 'finished';
    max_players: number;
    created_at: Date;
    started_at: Date | null;
    ended_at: Date | null;
    final_wave: number;
    final_time: number;
}

export const GameSession = {
    async create(id: string, hostUserId: number, mode: 'solo' | 'coop', maxPlayers: number): Promise<void> {
        await pool.query<ResultSetHeader>(
            'INSERT INTO game_sessions (id, host_user_id, mode, max_players) VALUES (?, ?, ?, ?)',
            [id, hostUserId, mode, maxPlayers]
        );
    },

    async findById(id: string): Promise<GameSessionRow | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM game_sessions WHERE id = ?', [id]
        );
        return (rows[0] as GameSessionRow) || null;
    },

    async start(id: string): Promise<void> {
        await pool.query(
            'UPDATE game_sessions SET status = ?, started_at = NOW() WHERE id = ?',
            ['playing', id]
        );
    },

    async finish(id: string, finalWave: number, finalTime: number): Promise<void> {
        await pool.query(
            'UPDATE game_sessions SET status = ?, ended_at = NOW(), final_wave = ?, final_time = ? WHERE id = ?',
            ['finished', finalWave, finalTime, id]
        );
    },

    async addPlayer(sessionId: string, userId: number, isHost: boolean): Promise<void> {
        await pool.query(
            'INSERT INTO session_players (session_id, user_id, is_host) VALUES (?, ?, ?)',
            [sessionId, userId, isHost]
        );
    },
};
