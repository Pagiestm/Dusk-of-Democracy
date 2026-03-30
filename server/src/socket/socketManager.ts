import type { Server } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
import { registerRoomHandlers } from '../handlers/RoomHandlers.js';
import { registerGameHandlers } from '../handlers/GameHandlers.js';

export function initSocketManager(io: Server): void {
    const roomManager = new RoomManager();

    io.on('connection', (socket) => {
        const playerName: string = (socket.handshake.auth as Record<string, unknown>).name as string || 'Joueur';
        console.log(`[+] ${playerName} (${socket.id})`);

        registerRoomHandlers(io, socket, roomManager, playerName);
        registerGameHandlers(io, socket, roomManager);
    });
}
