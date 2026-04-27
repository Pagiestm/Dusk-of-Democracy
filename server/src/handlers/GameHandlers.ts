import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';

export function registerGameHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
    let playerSnapRelayCount = 0;
    let worldSnapRelayCount = 0;

    // ── Player snapshot relay (host → clients) ──

    socket.on('game:players', (snapshot: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (room.hostId !== socket.id) return;

        playerSnapRelayCount++;
        if (playerSnapRelayCount <= 3 || playerSnapRelayCount % 300 === 0) {
            console.log(`[Relay] Player snapshot #${playerSnapRelayCount} → room ${room.code} (${room.players.size} players)`);
        }
        socket.to(room.id).emit('game:players', snapshot);
    });

    // ── World snapshot relay (host → clients) ──

    socket.on('game:world', (snapshot: unknown) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        if (room.hostId !== socket.id) return;

        worldSnapRelayCount++;
        if (worldSnapRelayCount <= 3 || worldSnapRelayCount % 200 === 0) {
            console.log(`[Relay] World snapshot #${worldSnapRelayCount} → room ${room.code} (${room.players.size} players)`);
        }
        socket.to(room.id).emit('game:world', snapshot);
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

    // ── Pause / resume relay (any player → everyone in the room) ──

    socket.on('game:pause', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        socket.to(room.id).emit('game:pause', { playerId: socket.id });
    });

    socket.on('game:resume', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.status !== 'playing') return;
        socket.to(room.id).emit('game:resume', { playerId: socket.id });
    });
}
