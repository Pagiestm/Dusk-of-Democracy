import type { Socket } from 'socket.io';
import type { Room, RoomPlayer, PublicRoomPlayer } from '../types.js';
import { MAX_PLAYERS_PER_ROOM, ROOM_CLEANUP_DELAY_MS } from '../config.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
    private rooms = new Map<string, Room>();
    private roomsByCode = new Map<string, string>(); // code → roomId

    // ─── Queries ────────────────────────────────────────────

    getRoomBySocket(socket: Socket): Room | null {
        const roomId = socket.data.roomId as string | undefined;
        if (!roomId) return null;
        return this.rooms.get(roomId) || null;
    }

    getRoomByCode(code: string): Room | null {
        const roomId = this.roomsByCode.get(code.toUpperCase());
        if (!roomId) return null;
        return this.rooms.get(roomId) || null;
    }

    getPlayer(room: Room, socketId: string): RoomPlayer | undefined {
        return room.players.get(socketId);
    }

    getPlayerList(room: Room): PublicRoomPlayer[] {
        return Array.from(room.players.values()).map(p => ({
            id: p.socketId,
            name: p.name,
            characterId: p.characterId,
            weaponId: p.weaponId,
            isHost: p.socketId === room.hostId,
            isReady: !!p.characterId && !!p.weaponId,
        }));
    }

    allPlayersReady(room: Room): boolean {
        return Array.from(room.players.values()).every(p => p.characterId && p.weaponId);
    }

    // ─── Mutations ──────────────────────────────────────────

    createRoom(socketId: string, playerName: string): Room {
        const code = this.generateCode();
        const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const room: Room = {
            id: roomId,
            code,
            hostId: socketId,
            players: new Map(),
            status: 'lobby',
        };

        room.players.set(socketId, {
            socketId,
            name: playerName,
            characterId: null,
            weaponId: null,
        });

        this.rooms.set(roomId, room);
        this.roomsByCode.set(code, roomId);

        return room;
    }

    addPlayer(room: Room, socketId: string, playerName: string): { error?: string } {
        if (room.status !== 'lobby') return { error: 'Partie en cours' };
        if (room.players.size >= MAX_PLAYERS_PER_ROOM) return { error: `Salon plein (${MAX_PLAYERS_PER_ROOM}/${MAX_PLAYERS_PER_ROOM})` };

        room.players.set(socketId, {
            socketId,
            name: playerName,
            characterId: null,
            weaponId: null,
        });

        return {};
    }

    removePlayer(room: Room, socketId: string): void {
        room.players.delete(socketId);

        if (room.players.size === 0) {
            this.rooms.delete(room.id);
            this.roomsByCode.delete(room.code);
        } else if (room.hostId === socketId) {
            const newHost = room.players.values().next().value;
            if (newHost) room.hostId = newHost.socketId;
        }
    }

    startSelection(room: Room): void {
        room.status = 'selecting';
        for (const p of room.players.values()) {
            p.characterId = null;
            p.weaponId = null;
        }
    }

    startGame(room: Room): void {
        room.status = 'playing';
    }

    finishGame(room: Room): void {
        room.status = 'finished';
        setTimeout(() => {
            this.rooms.delete(room.id);
            this.roomsByCode.delete(room.code);
        }, ROOM_CLEANUP_DELAY_MS);
    }

    // ─── Helpers ────────────────────────────────────────────

    private generateCode(): string {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        return code;
    }
}
