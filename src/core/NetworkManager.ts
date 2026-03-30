import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../constants';

// ─── Shared Types ────────────────────────────────────────────────────

export interface RoomPlayer {
    id: string;          // socket.id
    name: string;
    characterId: string | null;
    weaponId: string | null;
    isHost: boolean;
    isReady: boolean;
}

export interface EntitySnapshot {
    nid: number;
    type: string;       // 'enemy' | 'projectile' | 'pickup' | 'area_effect'
    defId?: string;
    x: number;
    z: number;
    hp?: number;
    maxHp?: number;
    angle?: number;
    scale?: number;
}

export interface PlayerNetState {
    id: string;         // socket.id
    characterId: string;
    alive: boolean;
    level: number;
    xpProgress: number; // 0..1 progress towards next level
    gold: number;
    kills: number;
    pendingLevelUps: number;
    x: number;
    z: number;
    angle: number;
    hp: number;
    maxHp: number;
    armor: number;
    maxArmor: number;
    speed: number;
}

export interface DamageEvent {
    x: number;
    z: number;
    damage: number;
    armor: boolean;
}

export interface FullSnapshot {
    tick: number;
    gameTime: number;
    wave: number;
    completedWave: number;
    nightFactor: number;
    timeOfDay: number;
    killCount: number;
    state: string;          // GameState value for clients
    readyPlayers: string[]; // IDs of players ready for next wave
    players: PlayerNetState[];
    entities: EntitySnapshot[];
    damageEvents: DamageEvent[];
}

// ─── Network Manager ─────────────────────────────────────────────────

export class NetworkManager {
    private socket: Socket | null = null;

    myId: string | null = null;
    playerName: string = '';

    // Room state
    roomId: string | null = null;
    roomCode: string | null = null;
    roomPlayers: RoomPlayer[] = [];
    isHost: boolean = false;

    // Callbacks (set by Game or UI screens)
    onRoomUpdated: (() => void) | null = null;
    onStartSelection: (() => void) | null = null;
    onGameStart: ((players: RoomPlayer[]) => void) | null = null;
    onSnapshot: ((snap: FullSnapshot) => void) | null = null;
    onRemoteInput: ((data: { playerId: string; moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }) => void) | null = null;
    onError: ((msg: string) => void) | null = null;
    onGameOver: (() => void) | null = null;
    onRemoteBuyItem: ((data: { playerId: string; itemId: string }) => void) | null = null;
    onRemotePlayerReady: ((data: { playerId: string }) => void) | null = null;
    onRemoteSelectUpgrade: ((data: { playerId: string; upgradeId: string }) => void) | null = null;

    // ─── Connection ──────────────────────────────────────────────

    get isConnected(): boolean { return !!this.socket?.connected; }

    connect(name: string): void {
        if (this.socket?.connected) return;

        this.playerName = name;
        this.socket = io(SERVER_URL, {
            auth: { name },
            transports: ['websocket'],  // Skip long-polling, connect via WebSocket directly
        });

        this.socket.on('connect', () => {
            this.myId = this.socket!.id!;
            console.log('[Net] Connected:', this.myId);
        });

        this.socket.on('disconnect', () => {
            console.log('[Net] Disconnected');
        });

        this.socket.on('connect_error', (err) => {
            console.error('[Net] Error:', err.message);
            this.onError?.(`Connexion impossible: ${err.message}`);
        });

        // ── Room Events ──

        this.socket.on('room:created', (data) => {
            this.roomId = data.roomId;
            this.roomCode = data.code;
            this.roomPlayers = data.players;
            this.isHost = true;
            this.onRoomUpdated?.();
        });

        this.socket.on('room:joined', (data) => {
            this.roomId = data.roomId;
            this.roomCode = data.code;
            this.roomPlayers = data.players;
            this.isHost = data.hostId === this.myId;
            this.onRoomUpdated?.();
        });

        this.socket.on('room:playerJoined', (d) => {
            this.roomPlayers = d.players;
            this.onRoomUpdated?.();
        });

        this.socket.on('room:playerUpdated', (d) => {
            this.roomPlayers = d.players;
            this.onRoomUpdated?.();
        });

        this.socket.on('room:playerLeft', (d) => {
            this.roomPlayers = d.players;
            if (d.hostId) this.isHost = d.hostId === this.myId;
            this.onRoomUpdated?.();
        });

        this.socket.on('room:error', (d) => this.onError?.(d.message));

        // ── Selection & Game Start ──

        this.socket.on('room:startSelection', (_data) => {
            this.onStartSelection?.();
        });

        this.socket.on('room:gameStart', (data) => {
            this.roomPlayers = data.players;
            this.onGameStart?.(data.players);
        });

        // ── In-Game ──

        // Track snapshot count for debugging
        let snapCount = 0;
        this.socket.on('game:snapshot', (snap: FullSnapshot) => {
            snapCount++;
            if (snapCount <= 3 || snapCount % 100 === 0) {
                console.log(`[Net] Snapshot #${snapCount} received: ${snap.players.length} players, ${snap.entities.length} entities`);
            }
            this.onSnapshot?.(snap);
        });

        this.socket.on('game:remoteInput', (data) => {
            this.onRemoteInput?.(data);
        });

        this.socket.on('game:over', () => {
            this.onGameOver?.();
        });

        // Host receives buy/ready from remote players
        this.socket.on('game:remoteBuyItem', (data) => {
            this.onRemoteBuyItem?.(data);
        });

        this.socket.on('game:remotePlayerReady', (data) => {
            this.onRemotePlayerReady?.(data);
        });

        this.socket.on('game:remoteSelectUpgrade', (data) => {
            this.onRemoteSelectUpgrade?.(data);
        });
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
        this.myId = null;
        this.roomId = null;
        this.roomCode = null;
        this.roomPlayers = [];
        this.isHost = false;
    }

    // ─── Lobby ───────────────────────────────────────────────────

    createRoom(): void {
        this.socket?.emit('room:create');
    }

    joinRoom(code: string): void {
        this.socket?.emit('room:join', { code: code.toUpperCase() });
    }

    leaveRoom(): void {
        this.socket?.emit('room:leave');
        this.roomId = null;
        this.roomCode = null;
        this.roomPlayers = [];
        this.isHost = false;
    }

    startSelection(): void {
        this.socket?.emit('room:startSelection');
    }

    selectCharacter(characterId: string): void {
        this.socket?.emit('room:selectCharacter', { characterId });
    }

    selectWeapon(weaponId: string): void {
        this.socket?.emit('room:selectWeapon', { weaponId });
    }

    // ─── In-Game ─────────────────────────────────────────────────

    sendSnapshot(snap: FullSnapshot): void {
        this.socket?.emit('game:snapshot', snap);
    }

    sendInput(data: { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }): void {
        this.socket?.emit('game:input', data);
    }

    sendGameOver(): void {
        this.socket?.emit('game:over');
    }

    sendSelectUpgrade(upgradeId: string): void {
        this.socket?.emit('game:selectUpgrade', { upgradeId });
    }

    sendBuyItem(itemId: string): void {
        this.socket?.emit('game:buyItem', { itemId });
    }

    sendPlayerReady(): void {
        this.socket?.emit('game:playerReady');
    }
}
