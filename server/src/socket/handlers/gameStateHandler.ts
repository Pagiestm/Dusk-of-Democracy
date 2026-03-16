import { Server, Socket } from 'socket.io';
import { GameRoom } from '../../game/GameRoom.js';
import { scoreService } from '../../services/scoreService.js';
import { sessionService } from '../../services/sessionService.js';

export function registerGameStateHandlers(
    io: Server,
    socket: Socket,
    rooms: Map<string, GameRoom>,
    userId: number
) {
    // Host sends full snapshot → relay to all other clients
    socket.on('game:snapshot', (snapshot: any) => {
        const room = getRoom(socket, rooms);
        if (!room || room.status !== 'playing') return;
        if (room.hostUserId !== userId) return;

        socket.to(room.id).volatile.emit('game:snapshot', snapshot);
    });

    // Client sends input → relay to host
    socket.on('game:input', (input: any) => {
        const room = getRoom(socket, rooms);
        if (!room || room.status !== 'playing') return;

        const host = room.players.get(room.hostUserId);
        if (host && host.socketId !== socket.id) {
            io.to(host.socketId).volatile.emit('game:remoteInput', {
                userId,
                ...input,
            });
        }
    });

    // Host signals game over
    socket.on('game:over', () => {
        const room = getRoom(socket, rooms);
        if (!room || room.hostUserId !== userId) return;

        socket.to(room.id).emit('game:over');
    });

    // Host submits final scores
    socket.on('game:submitScores', async (statsArray: any[]) => {
        const room = getRoom(socket, rooms);
        if (!room || !room.sessionId) return;
        if (room.hostUserId !== userId) return;

        try {
            let maxWave = 0;
            let maxTime = 0;

            for (const stats of statsArray) {
                const player = room.players.get(parseInt(stats.playerId));
                if (!player) continue;

                await scoreService.submitScore(room.sessionId, player.userId, stats);
                maxWave = Math.max(maxWave, stats.waveReached);
                maxTime = Math.max(maxTime, stats.timeSurvived);
            }

            await sessionService.finishSession(room.sessionId, maxWave, maxTime);
            room.finish();

            io.to(room.id).emit('game:scoresSubmitted', { success: true });
        } catch (err: any) {
            socket.emit('game:error', { message: err.message });
        }
    });
}

function getRoom(socket: Socket, rooms: Map<string, GameRoom>): GameRoom | null {
    const roomId = socket.data.roomId;
    if (!roomId) return null;
    return rooms.get(roomId) || null;
}
