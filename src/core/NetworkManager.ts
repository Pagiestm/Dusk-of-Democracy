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

export interface PlayerSnapshot {
    tick: number;
    gameTime: number;
    players: PlayerNetState[];
}

// ─── Event-Driven Types (replace WorldSnapshot) ─────────────────────

export interface EnemySpawnEvent {
    nid: number;
    defId: string;
    x: number;
    z: number;
    hp: number;
    damage: number;
    speed: number;
    scale: number;
}

export interface EnemyDieEvent {
    nid: number;
}

export interface ProjectileFireEvent {
    nid: number;
    playerId: string;
    x: number;
    z: number;
    dirX: number;
    dirZ: number;
    speed: number;
    lifetime: number;
    damage: number;
    isEnemy: boolean;
    modelPath?: string;
    modelScale?: number;
    text?: string;
}

export interface PickupSpawnEvent {
    nid: number;
    x: number;
    z: number;
    xpValue: number;
}

export interface PickupCollectedEvent {
    nid: number;
}

export interface AreaEffectEvent {
    x: number;
    z: number;
    radius: number;
}

export interface WallEffectEvent {
    x: number;
    z: number;
    dirX: number;
    dirZ: number;
    halfWidth: number;
    damage: number;
    lifetime: number;
}

export interface StateSyncEvent {
    gameTime: number;
    state: string;
    wave: number;
    completedWave: number;
    killCount: number;
    nightFactor: number;
    timeOfDay: number;
    readyPlayers: string[];
}

export interface DamageEventNet {
    x: number;
    z: number;
    damage: number;
    armor: boolean;
}

// ─── Legacy types (kept for backward compat during transition) ──────

export interface EntitySnapshot {
    nid: number;
    type: string;
    defId?: string;
    x: number;
    z: number;
    hp?: number;
    maxHp?: number;
    angle?: number;
    scale?: number;
    animState?: string;
}

export interface WorldSnapshot {
    tick: number;
    gameTime: number;
    wave: number;
    completedWave: number;
    nightFactor: number;
    timeOfDay: number;
    killCount: number;
    state: string;
    readyPlayers: string[];
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
    onPlayerSnapshot: ((snap: PlayerSnapshot) => void) | null = null;
    onRemoteInput: ((data: { playerId: string; moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }) => void) | null = null;
    onError: ((msg: string) => void) | null = null;
    onGameOver: (() => void) | null = null;
    onRemotePause: (() => void) | null = null;
    onRemoteResume: (() => void) | null = null;
    onRemoteBuyItem: ((data: { playerId: string; itemId: string }) => void) | null = null;
    onRemotePlayerReady: ((data: { playerId: string }) => void) | null = null;
    onRemoteSelectUpgrade: ((data: { playerId: string; upgradeId: string }) => void) | null = null;

    // Event-driven callbacks (new system)
    onEnemySpawn: ((data: EnemySpawnEvent) => void) | null = null;
    onEnemyDie: ((data: EnemyDieEvent) => void) | null = null;
    onProjectileFire: ((data: ProjectileFireEvent) => void) | null = null;
    onPickupSpawn: ((data: PickupSpawnEvent) => void) | null = null;
    onPickupCollected: ((data: PickupCollectedEvent) => void) | null = null;
    onAreaEffect: ((data: AreaEffectEvent) => void) | null = null;
    onWallEffect: ((data: WallEffectEvent) => void) | null = null;
    onStateSync: ((data: StateSyncEvent) => void) | null = null;
    onDamageEvent: ((data: DamageEventNet) => void) | null = null;

    // ─── Connection ──────────────────────────────────────────────

    get isConnected(): boolean { return !!this.socket?.connected; }

    connect(name: string): void {
        if (this.socket?.connected) return;

        this.playerName = name;
        this.socket = io(SERVER_URL, {
            auth: { name },
            transports: ['websocket'],
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

        // ── In-Game: Player snapshot ──

        let playerSnapCount = 0;
        this.socket.on('game:players', (snap: PlayerSnapshot) => {
            playerSnapCount++;
            if (playerSnapCount <= 3 || playerSnapCount % 100 === 0) {
                console.log(`[Net] Player snapshot #${playerSnapCount} received: ${snap.players.length} players`);
            }
            this.onPlayerSnapshot?.(snap);
        });

        this.socket.on('game:remoteInput', (data) => {
            this.onRemoteInput?.(data);
        });

        this.socket.on('game:over', () => {
            this.onGameOver?.();
        });

        this.socket.on('game:pause', () => {
            this.onRemotePause?.();
        });

        this.socket.on('game:resume', () => {
            this.onRemoteResume?.();
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

        // ── In-Game: Event-driven sync (new system) ──

        this.socket.on('game:enemySpawn', (data: EnemySpawnEvent) => {
            this.onEnemySpawn?.(data);
        });

        this.socket.on('game:enemyDie', (data: EnemyDieEvent) => {
            this.onEnemyDie?.(data);
        });

        this.socket.on('game:projectileFire', (data: ProjectileFireEvent) => {
            this.onProjectileFire?.(data);
        });

        this.socket.on('game:pickupSpawn', (data: PickupSpawnEvent) => {
            this.onPickupSpawn?.(data);
        });

        this.socket.on('game:pickupCollected', (data: PickupCollectedEvent) => {
            this.onPickupCollected?.(data);
        });

        this.socket.on('game:areaEffect', (data: AreaEffectEvent) => {
            this.onAreaEffect?.(data);
        });

        this.socket.on('game:wallEffect', (data: WallEffectEvent) => {
            this.onWallEffect?.(data);
        });

        this.socket.on('game:stateSync', (data: StateSyncEvent) => {
            this.onStateSync?.(data);
        });

        this.socket.on('game:damageEvent', (data: DamageEventNet) => {
            this.onDamageEvent?.(data);
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

    sendPlayerSnapshot(snap: PlayerSnapshot): void {
        this.socket?.emit('game:players', snap);
    }

    sendInput(data: { moveX: number; moveZ: number; aimX: number; aimZ: number; fire: boolean }): void {
        this.socket?.emit('game:input', data);
    }

    sendGameOver(): void {
        this.socket?.emit('game:over');
    }

    sendPause(): void {
        this.socket?.emit('game:pause');
    }

    sendResume(): void {
        this.socket?.emit('game:resume');
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

    // ─── Event-driven sync (host → clients) ─────────────────────

    sendEnemySpawn(data: EnemySpawnEvent): void {
        this.socket?.emit('game:enemySpawn', data);
    }

    sendEnemyDie(data: EnemyDieEvent): void {
        this.socket?.emit('game:enemyDie', data);
    }

    sendProjectileFire(data: ProjectileFireEvent): void {
        this.socket?.emit('game:projectileFire', data);
    }

    sendPickupSpawn(data: PickupSpawnEvent): void {
        this.socket?.emit('game:pickupSpawn', data);
    }

    sendPickupCollected(data: PickupCollectedEvent): void {
        this.socket?.emit('game:pickupCollected', data);
    }

    sendAreaEffect(data: AreaEffectEvent): void {
        this.socket?.emit('game:areaEffect', data);
    }

    sendWallEffect(data: WallEffectEvent): void {
        this.socket?.emit('game:wallEffect', data);
    }

    sendStateSync(data: StateSyncEvent): void {
        this.socket?.emit('game:stateSync', data);
    }

    sendDamageEvent(data: DamageEventNet): void {
        this.socket?.emit('game:damageEvent', data);
    }
}
