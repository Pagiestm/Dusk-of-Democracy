import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';

export function registerGameHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
    let snapRelayCount = 0;

    // ── Snapshot relay (host → clients) ──

    socket.on('game:snapshot', (snapshot: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (room.hostId !== socket.id) return;

        snapRelayCount++;
        if (snapRelayCount <= 3 || snapRelayCount % 200 === 0) {
            console.log(`[Relay] Snapshot #${snapRelayCount} → room ${room.code} (${room.players.size} players)`);
        }
        socket.to(room.id).emit('game:snapshot', snapshot);
    });

    // ── Input relay (client → host) ──

    socket.on('game:input', (input: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (socket.id === room.hostId) return;

        io.to(room.hostId).emit('game:remoteInput', {
            playerId: socket.id,
            ...(input as Record<string, unknown>),
        });
    });

    // ── Shop: buy item (client → host) ──

    socket.on('game:buyItem', (data: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (socket.id === room.hostId) return;

        io.to(room.hostId).emit('game:remoteBuyItem', {
            playerId: socket.id,
            ...(data as Record<string, unknown>),
        });
    });

    // ── Upgrade selection (client → host) ──

    socket.on('game:selectUpgrade', (data: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (socket.id === room.hostId) return;

        io.to(room.hostId).emit('game:remoteSelectUpgrade', {
            playerId: socket.id,
            ...(data as Record<string, unknown>),
        });
    });

    // ── Player ready (client → host) ──

    socket.on('game:playerReady', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (socket.id === room.hostId) return;

        io.to(room.hostId).emit('game:remotePlayerReady', { playerId: socket.id });
    });

    // ── Game over (host → clients) ──

    socket.on('game:over', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.hostId !== socket.id) return;

        roomManager.finishGame(room);
        socket.to(room.id).emit('game:over');
    });
}
