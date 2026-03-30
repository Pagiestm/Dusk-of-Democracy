export type RoomStatus = 'lobby' | 'selecting' | 'playing' | 'finished';

export interface RoomPlayer {
    socketId: string;
    name: string;
    characterId: string | null;
    weaponId: string | null;
}

export interface Room {
    id: string;
    code: string;
    hostId: string;
    players: Map<string, RoomPlayer>;
    status: RoomStatus;
}

export interface PublicRoomPlayer {
    id: string;
    name: string;
    characterId: string | null;
    weaponId: string | null;
    isHost: boolean;
    isReady: boolean;
}
