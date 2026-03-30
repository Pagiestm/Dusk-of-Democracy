import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';

export function registerRoomHandlers(io: Server, socket: Socket, roomManager: RoomManager, playerName: string): void {

    // ── Create ──

    socket.on('room:create', () => {
        const room = roomManager.createRoom(socket.id, playerName);

        socket.join(room.id);
        socket.data.roomId = room.id;

        socket.emit('room:created', {
            roomId: room.id,
            code: room.code,
            hostId: room.hostId,
            players: roomManager.getPlayerList(room),
        });
    });

    // ── Join ──

    socket.on('room:join', ({ code }: { code: string }) => {
        const room = roomManager.getRoomByCode(code);
        if (!room) { socket.emit('room:error', { message: 'Code invalide' }); return; }

        const result = roomManager.addPlayer(room, socket.id, playerName);
        if (result.error) { socket.emit('room:error', { message: result.error }); return; }

        socket.join(room.id);
        socket.data.roomId = room.id;

        socket.emit('room:joined', {
            roomId: room.id,
            code: room.code,
            hostId: room.hostId,
            players: roomManager.getPlayerList(room),
        });
        socket.to(room.id).emit('room:playerJoined', {
            players: roomManager.getPlayerList(room),
        });
    });

    // ── Leave ──

    socket.on('room:leave', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (room) handleLeave(io, socket, roomManager, room);
    });

    // ── Selection Phase ──

    socket.on('room:startSelection', () => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;

        roomManager.startSelection(room);
        io.to(room.id).emit('room:startSelection', {
            players: roomManager.getPlayerList(room),
        });
    });

    socket.on('room:selectCharacter', ({ characterId }: { characterId: string }) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room) return;

        const player = roomManager.getPlayer(room, socket.id);
        if (player) {
            player.characterId = characterId;
            io.to(room.id).emit('room:playerUpdated', { players: roomManager.getPlayerList(room) });
        }
    });

    socket.on('room:selectWeapon', ({ weaponId }: { weaponId: string }) => {
        const room = roomManager.getRoomBySocket(socket);
        if (!room) return;

        const player = roomManager.getPlayer(room, socket.id);
        if (!player) return;

        player.weaponId = weaponId;
        io.to(room.id).emit('room:playerUpdated', { players: roomManager.getPlayerList(room) });

        // Auto-start when all players are ready
        if (roomManager.allPlayersReady(room) && room.status === 'selecting') {
            roomManager.startGame(room);
            io.to(room.id).emit('room:gameStart', {
                players: roomManager.getPlayerList(room),
            });
        }
    });

    // ── Disconnect ──

    socket.on('disconnect', () => {
        console.log(`[-] ${playerName} (${socket.id})`);
        const room = roomManager.getRoomBySocket(socket);
        if (room) handleLeave(io, socket, roomManager, room);
    });
}

function handleLeave(io: Server, socket: Socket, roomManager: RoomManager, room: import('../types.js').Room): void {
    roomManager.removePlayer(room, socket.id);
    socket.leave(room.id);
    socket.data.roomId = undefined;

    // Room still has players → notify them
    if (room.players.size > 0) {
        io.to(room.id).emit('room:playerLeft', {
            players: roomManager.getPlayerList(room),
            hostId: room.hostId,
        });
    }
}
