import { v4 as uuidv4 } from 'uuid';
import { MAX_PLAYERS_PER_ROOM, RECONNECT_TIMEOUT_MS } from './shared/constants.js';

export interface RoomPlayer {
    socketId: string;
    userId: number;
    username: string;
    characterId: string | null;
    weaponId: string | null;
    isHost: boolean;
    isReady: boolean;
    isConnected: boolean;
    isAlive: boolean;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export class GameRoom {
    id: string;
    code: string;
    mode: 'solo' | 'coop';
    status: RoomStatus = 'lobby';
    maxPlayers: number;
    players: Map<number, RoomPlayer> = new Map(); // keyed by userId
    hostUserId: number;
    sessionId: string | null = null;
    createdAt: Date;

    private reconnectTimers: Map<number, NodeJS.Timeout> = new Map();

    constructor(hostUserId: number, mode: 'solo' | 'coop', maxPlayers?: number) {
        this.id = uuidv4();
        this.code = this.generateCode();
        this.mode = mode;
        this.maxPlayers = Math.min(maxPlayers || MAX_PLAYERS_PER_ROOM, MAX_PLAYERS_PER_ROOM);
        this.hostUserId = hostUserId;
        this.createdAt = new Date();
    }

    private generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    addPlayer(socketId: string, userId: number, username: string): boolean {
        if (this.players.size >= this.maxPlayers) return false;
        if (this.status !== 'lobby') return false;

        this.players.set(userId, {
            socketId,
            userId,
            username,
            characterId: null,
            weaponId: null,
            isHost: userId === this.hostUserId,
            isReady: false,
            isConnected: true,
            isAlive: true,
        });
        return true;
    }

    removePlayer(userId: number): void {
        this.players.delete(userId);
        this.clearReconnectTimer(userId);

        // Transfer host if the host left during lobby
        if (userId === this.hostUserId && this.players.size > 0) {
            const newHost = this.players.values().next().value;
            if (newHost) {
                newHost.isHost = true;
                this.hostUserId = newHost.userId;
            }
        }
    }

    setCharacter(userId: number, characterId: string): void {
        const p = this.players.get(userId);
        if (p) p.characterId = characterId;
    }

    setWeapon(userId: number, weaponId: string): void {
        const p = this.players.get(userId);
        if (p) {
            p.weaponId = weaponId;
            p.isReady = !!p.characterId;
        }
    }

    canStart(): boolean {
        if (this.players.size === 0) return false;
        for (const p of this.players.values()) {
            if (!p.characterId || !p.weaponId) return false;
        }
        return true;
    }

    start(sessionId: string): void {
        this.status = 'playing';
        this.sessionId = sessionId;
        for (const p of this.players.values()) {
            p.isAlive = true;
        }
    }

    finish(): void {
        this.status = 'finished';
        for (const timer of this.reconnectTimers.values()) {
            clearTimeout(timer);
        }
        this.reconnectTimers.clear();
    }

    playerDied(userId: number): void {
        const p = this.players.get(userId);
        if (p) p.isAlive = false;
    }

    allDead(): boolean {
        for (const p of this.players.values()) {
            if (p.isAlive && p.isConnected) return false;
        }
        return true;
    }

    disconnectPlayer(userId: number, onTimeout: () => void): void {
        const p = this.players.get(userId);
        if (!p) return;
        p.isConnected = false;

        if (this.status === 'playing') {
            const timer = setTimeout(() => {
                this.reconnectTimers.delete(userId);
                onTimeout();
            }, RECONNECT_TIMEOUT_MS);
            this.reconnectTimers.set(userId, timer);
        }
    }

    reconnectPlayer(socketId: string, userId: number): boolean {
        const p = this.players.get(userId);
        if (!p) return false;
        p.socketId = socketId;
        p.isConnected = true;
        this.clearReconnectTimer(userId);
        return true;
    }

    private clearReconnectTimer(userId: number): void {
        const timer = this.reconnectTimers.get(userId);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(userId);
        }
    }

    getPlayerList() {
        return Array.from(this.players.values()).map(p => ({
            userId: p.userId,
            username: p.username,
            characterId: p.characterId,
            weaponId: p.weaponId,
            isHost: p.isHost,
            isReady: p.isReady,
            isConnected: p.isConnected,
            isAlive: p.isAlive,
        }));
    }

    isEmpty(): boolean {
        return this.players.size === 0;
    }
}
