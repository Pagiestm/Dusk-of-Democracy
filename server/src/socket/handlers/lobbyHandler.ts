import { Server, Socket } from 'socket.io';
import { GameRoom } from '../../game/GameRoom.js';
import { sessionService } from '../../services/sessionService.js';

export function registerLobbyHandlers(
    io: Server,
    socket: Socket,
    rooms: Map<string, GameRoom>,
    roomsByCode: Map<string, string>,
    userId: number,
    username: string
) {
    // Create a room
    socket.on('room:create', ({ mode, maxPlayers }: { mode: 'solo' | 'coop'; maxPlayers?: number }) => {
        const room = new GameRoom(userId, mode, maxPlayers);
        room.addPlayer(socket.id, userId, username);

        rooms.set(room.id, room);
        roomsByCode.set(room.code, room.id);

        socket.join(room.id);
        socket.data.roomId = room.id;

        socket.emit('room:created', {
            roomId: room.id,
            roomCode: room.code,
            players: room.getPlayerList(),
        });
    });

    // Join a room by code
    socket.on('room:join', ({ roomCode }: { roomCode: string }) => {
        const roomId = roomsByCode.get(roomCode.toUpperCase());
        if (!roomId) {
            socket.emit('room:error', { message: 'Code de salon invalide' });
            return;
        }

        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('room:error', { message: 'Salon introuvable' });
            return;
        }

        const added = room.addPlayer(socket.id, userId, username);
        if (!added) {
            socket.emit('room:error', { message: 'Salon plein ou déjà en jeu' });
            return;
        }

        socket.join(room.id);
        socket.data.roomId = room.id;

        socket.emit('room:joined', {
            roomId: room.id,
            roomCode: room.code,
            players: room.getPlayerList(),
        });

        socket.to(room.id).emit('room:playerJoined', {
            userId,
            username,
            players: room.getPlayerList(),
        });
    });

    // Select character
    socket.on('room:selectCharacter', ({ characterId }: { characterId: string }) => {
        const room = getRoom(socket, rooms);
        if (!room) return;

        room.setCharacter(userId, characterId);
        io.to(room.id).emit('room:playerUpdated', { players: room.getPlayerList() });
    });

    // Select weapon
    socket.on('room:selectWeapon', ({ weaponId }: { weaponId: string }) => {
        const room = getRoom(socket, rooms);
        if (!room) return;

        room.setWeapon(userId, weaponId);
        io.to(room.id).emit('room:playerUpdated', { players: room.getPlayerList() });
    });

    // Start game (host only)
    socket.on('room:start', async () => {
        const room = getRoom(socket, rooms);
        if (!room) return;

        if (room.hostUserId !== userId) {
            socket.emit('room:error', { message: 'Seul l\'hôte peut lancer la partie' });
            return;
        }

        if (!room.canStart()) {
            socket.emit('room:error', { message: 'Tous les joueurs doivent choisir un personnage et une arme' });
            return;
        }

        // Persist session to DB
        const { id: sessionId } = await sessionService.createSession(userId, room.mode, room.maxPlayers);
        for (const p of room.players.values()) {
            if (p.userId !== userId) {
                await sessionService.joinSession(sessionId, p.userId);
            }
        }
        await sessionService.startSession(sessionId);

        room.start(sessionId);

        io.to(room.id).emit('room:gameStarting', {
            sessionId,
            players: room.getPlayerList(),
        });
    });

    // Leave room
    socket.on('room:leave', () => {
        const room = getRoom(socket, rooms);
        if (!room) return;

        leaveRoom(io, socket, room, rooms, roomsByCode, userId);
    });
}

function getRoom(socket: Socket, rooms: Map<string, GameRoom>): GameRoom | null {
    const roomId = socket.data.roomId;
    if (!roomId) return null;
    return rooms.get(roomId) || null;
}

export function leaveRoom(
    io: Server,
    socket: Socket,
    room: GameRoom,
    rooms: Map<string, GameRoom>,
    roomsByCode: Map<string, string>,
    userId: number
) {
    room.removePlayer(userId);
    socket.leave(room.id);
    socket.data.roomId = undefined;

    if (room.isEmpty()) {
        rooms.delete(room.id);
        roomsByCode.delete(room.code);
    } else {
        io.to(room.id).emit('room:playerLeft', {
            userId,
            players: room.getPlayerList(),
        });
    }
}
