import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '4000', 10),

    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
    DB_USER: process.env.DB_USER || 'doduser',
    DB_PASSWORD: process.env.DB_PASSWORD || 'dodpassword',
    DB_NAME: process.env.DB_NAME || 'dusk_of_democracy',

    JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
