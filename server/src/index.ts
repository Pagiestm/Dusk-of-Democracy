import { createServer } from 'http';
import { Server } from 'socket.io';
import { PORT, CORS_OPTIONS } from './config.js';
import { initSocketManager } from './socket/SocketManager.js';

const httpServer = createServer();
const io = new Server(httpServer, { cors: CORS_OPTIONS });

initSocketManager(io);

httpServer.listen(PORT, () => {
    console.log(`Relay server on :${PORT}`);
});
