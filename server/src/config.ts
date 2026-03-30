export const PORT = parseInt(process.env.PORT || '4000');

export const MAX_PLAYERS_PER_ROOM = 4;

export const ROOM_CLEANUP_DELAY_MS = 10_000;

export const CORS_OPTIONS = {
    origin: '*',
    methods: ['GET', 'POST'],
};
