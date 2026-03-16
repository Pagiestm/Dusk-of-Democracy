import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export async function testConnection(): Promise<void> {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL connected successfully');
    conn.release();
}
