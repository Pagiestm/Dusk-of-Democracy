import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../constants';

export interface RoomPlayer {
    userId: number;
    username: string;
    characterId: string | null;
    weaponId: string | null;
    isHost: boolean;
    isReady: boolean;
    isConnected: boolean;
    isAlive: boolean;
}

export interface AuthResult {
    userId: number;
    username: string;
    token: string;
}

export interface EntitySnapshot {
    nid: number;       // network id
    type: string;      // 'enemy' | 'projectile' | 'pickup'
    defId?: string;    // enemy def id
    x: number;
    z: number;
    hp?: number;
    angle?: number;
    scale?: number;
    color?: number[];  // [r,g,b] for projectile
}

export interface PlayerNetState {
    userId: number;
    x: number;
    z: number;
    angle: number;
    hp: number;
    maxHp: number;
    armor: number;
    maxArmor: number;
    speed: number;
}

export interface FullSnapshot {
    tick: number;
    gameTime: number;
    wave: number;
    nightFactor: number;
    players: PlayerNetState[];
    entities: EntitySnapshot[];
}

export class NetworkManager {
    private socket: Socket | null = null;
    private token: string | null = null;

    userId: number | null = null;
    username: string | null = null;

    // Room state
    roomId: string | null = null;
    roomCode: string | null = null;
    roomPlayers: RoomPlayer[] = [];
    isHost: boolean = false;
    isMultiplayer: boolean = false;
    sessionId: string | null = null;

    // Callbacks
    onRoomUpdated: (() => void) | null = null;
    onGameStarting: ((players: RoomPlayer[]) => void) | null = null;
    onSnapshot: ((snap: FullSnapshot) => void) | null = null;
    onRemoteInput: ((data: { userId: number; moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }) => void) | null = null;
    onError: ((msg: string) => void) | null = null;
    onGameOver: (() => void) | null = null;

    // ─── Auth (REST) ────────────────────────────────────────────

    async register(username: string, email: string, password: string): Promise<AuthResult> {
        const res = await fetch(`${SERVER_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inscription');
        this.token = data.token;
        this.userId = data.userId;
        this.username = username;
        return { userId: data.userId, username, token: data.token };
    }

    async login(email: string, password: string): Promise<AuthResult> {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur connexion');
        this.token = data.token;
        this.userId = data.userId;
        this.username = data.username;
        return data;
    }

    get isLoggedIn(): boolean {
        return !!this.token;
    }

    // ─── Socket Connection ──────────────────────────────────────

    connect(): void {
        if (this.socket?.connected) return;
        if (!this.token) throw new Error('Non authentifié');

        this.socket = io(SERVER_URL, { auth: { token: this.token } });

        this.socket.on('connect', () => console.log('[Net] Connected'));
        this.socket.on('disconnect', () => console.log('[Net] Disconnected'));
        this.socket.on('connect_error', (err) => {
            console.error('[Net] Error:', err.message);
            this.onError?.(err.message);
        });

        // Lobby
        this.socket.on('room:created', (data) => {
            this.roomId = data.roomId;
            this.roomCode = data.roomCode;
            this.roomPlayers = data.players;
            this.isHost = true;
            this.onRoomUpdated?.();
        });
        this.socket.on('room:joined', (data) => {
            this.roomId = data.roomId;
            this.roomCode = data.roomCode;
            this.roomPlayers = data.players;
            this.isHost = false;
            this.onRoomUpdated?.();
        });
        this.socket.on('room:playerJoined', (d) => { this.roomPlayers = d.players; this.onRoomUpdated?.(); });
        this.socket.on('room:playerUpdated', (d) => { this.roomPlayers = d.players; this.onRoomUpdated?.(); });
        this.socket.on('room:playerLeft', (d) => { this.roomPlayers = d.players; this.onRoomUpdated?.(); });
        this.socket.on('room:error', (d) => this.onError?.(d.message));

        // Game start
        this.socket.on('room:gameStarting', (data) => {
            this.sessionId = data.sessionId;
            this.roomPlayers = data.players;
            this.onGameStarting?.(data.players);
        });

        // In-game: full snapshot from host
        this.socket.on('game:snapshot', (snap: FullSnapshot) => this.onSnapshot?.(snap));

        // In-game: remote input forwarded to host
        this.socket.on('game:remoteInput', (data) => this.onRemoteInput?.(data));

        this.socket.on('game:over', () => this.onGameOver?.());
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
        this.roomId = null;
        this.roomCode = null;
        this.roomPlayers = [];
        this.isHost = false;
        this.isMultiplayer = false;
    }

    // ─── Lobby ──────────────────────────────────────────────────

    createRoom(mode: 'solo' | 'coop' = 'coop', maxPlayers = 4): void {
        this.isMultiplayer = true;
        this.socket?.emit('room:create', { mode, maxPlayers });
    }

    joinRoom(code: string): void {
        this.isMultiplayer = true;
        this.socket?.emit('room:join', { roomCode: code.toUpperCase() });
    }

    selectCharacter(characterId: string): void {
        this.socket?.emit('room:selectCharacter', { characterId });
    }

    selectWeapon(weaponId: string): void {
        this.socket?.emit('room:selectWeapon', { weaponId });
    }

    startGame(): void {
        this.socket?.emit('room:start');
    }

    leaveRoom(): void {
        this.socket?.emit('room:leave');
        this.roomId = null;
        this.roomCode = null;
        this.roomPlayers = [];
        this.isHost = false;
        this.isMultiplayer = false;
    }

    // ─── In-Game (Host → Server → Clients) ──────────────────────

    /** Host sends full snapshot of entire game state */
    sendSnapshot(snap: FullSnapshot): void {
        this.socket?.volatile.emit('game:snapshot', snap);
    }

    /** Client sends input to host via server relay */
    sendInput(data: { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }): void {
        this.socket?.volatile.emit('game:input', data);
    }

    sendGameOver(): void {
        this.socket?.emit('game:over');
    }

    sendScores(stats: any[]): void {
        this.socket?.emit('game:submitScores', stats);
    }

    async getLeaderboard(): Promise<any[]> {
        const res = await fetch(`${SERVER_URL}/api/scores/leaderboard`);
        return res.json();
    }
}
