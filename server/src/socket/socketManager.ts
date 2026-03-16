import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { authService } from '../services/authService.js';
import { GameRoom } from '../game/GameRoom.js';
import { registerLobbyHandlers, leaveRoom } from './handlers/lobbyHandler.js';
import { registerGameStateHandlers } from './handlers/gameStateHandler.js';

// Global state
const rooms = new Map<string, GameRoom>();
const roomsByCode = new Map<string, string>(); // code -> roomId

export function setupSocketIO(httpServer: HttpServer): Server {
    const io = new Server(httpServer, {
        cors: {
            origin: env.CORS_ORIGIN,
            methods: ['GET', 'POST'],
        },
    });

    // Auth middleware — verify JWT on connection
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Token d\'authentification requis'));
        }

        try {
            const payload = authService.verifyToken(token);
            socket.data.userId = payload.userId;
            socket.data.username = payload.username;
            next();
        } catch {
            next(new Error('Token invalide'));
        }
    });

    io.on('connection', (socket) => {
        const userId: number = socket.data.userId;
        const username: string = socket.data.username;

        console.log(`[Socket] ${username} (${userId}) connected - ${socket.id}`);

        // Register all event handlers
        registerLobbyHandlers(io, socket, rooms, roomsByCode, userId, username);
        registerGameStateHandlers(io, socket, rooms, userId);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`[Socket] ${username} (${userId}) disconnected`);

            const roomId = socket.data.roomId;
            if (!roomId) return;

            const room = rooms.get(roomId);
            if (!room) return;

            if (room.status === 'lobby') {
                // In lobby: remove player immediately
                leaveRoom(io, socket, room, rooms, roomsByCode, userId);
            } else if (room.status === 'playing') {
                // In game: start reconnection timer
                room.disconnectPlayer(userId, () => {
                    // Timeout expired — treat as leave
                    room.removePlayer(userId);
                    io.to(room.id).emit('room:playerLeft', {
                        userId,
                        players: room.getPlayerList(),
                    });

                    if (room.isEmpty() || room.allDead()) {
                        room.finish();
                        rooms.delete(room.id);
                        roomsByCode.delete(room.code);
                    }
                });

                io.to(room.id).emit('room:playerDisconnected', {
                    userId,
                    username,
                });
            }
        });

        // Handle reconnection to existing room
        socket.on('room:reconnect', ({ roomId: targetRoomId }: { roomId: string }) => {
            const room = rooms.get(targetRoomId);
            if (!room) {
                socket.emit('room:error', { message: 'Salon introuvable' });
                return;
            }

            const reconnected = room.reconnectPlayer(socket.id, userId);
            if (!reconnected) {
                socket.emit('room:error', { message: 'Impossible de se reconnecter' });
                return;
            }

            socket.join(room.id);
            socket.data.roomId = room.id;

            socket.emit('room:reconnected', {
                roomId: room.id,
                status: room.status,
                players: room.getPlayerList(),
            });

            socket.to(room.id).emit('room:playerReconnected', {
                userId,
                username,
            });
        });
    });

    return io;
}
