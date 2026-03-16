import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/env.js';
import { testConnection } from './config/database.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupSocketIO } from './socket/socketManager.js';

const app = express();

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

// HTTP + WebSocket server
const httpServer = createServer(app);
const io = setupSocketIO(httpServer);

// Start
async function start() {
    try {
        await testConnection();
        console.log('[DB] Connected to MySQL');
    } catch (err) {
        console.warn('[DB] MySQL not available yet, will retry on first query');
    }

    httpServer.listen(env.PORT, () => {
        console.log(`[Server] Running on port ${env.PORT}`);
        console.log(`[Server] Environment: ${env.NODE_ENV}`);
        console.log(`[Socket] WebSocket ready`);
    });
}

start();

export { app, io };
