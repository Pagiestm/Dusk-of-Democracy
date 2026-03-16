import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface UserRow {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    created_at: Date;
    total_games: number;
    total_kills: number;
    best_wave: number;
    best_time: number;
}

export const User = {
    async findById(id: number): Promise<UserRow | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM users WHERE id = ?', [id]
        );
        return (rows[0] as UserRow) || null;
    },

    async findByEmail(email: string): Promise<UserRow | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        return (rows[0] as UserRow) || null;
    },

    async findByUsername(username: string): Promise<UserRow | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM users WHERE username = ?', [username]
        );
        return (rows[0] as UserRow) || null;
    },

    async create(username: string, email: string, passwordHash: string): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );
        return result.insertId;
    },

    async updateStats(
        userId: number,
        kills: number,
        waveReached: number,
        timeSurvived: number
    ): Promise<void> {
        await pool.query(
            `UPDATE users SET
                total_games = total_games + 1,
                total_kills = total_kills + ?,
                best_wave = GREATEST(best_wave, ?),
                best_time = GREATEST(best_time, ?)
            WHERE id = ?`,
            [kills, waveReached, timeSurvived, userId]
        );
    },
};
