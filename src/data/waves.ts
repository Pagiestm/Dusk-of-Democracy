import { WaveDef } from '../types';

export const WAVES: WaveDef[] = [
    {
        wave: 1,
        enemies: [{ enemyId: 'basic', count: 10 }],
        spawnInterval: 1.5,
        duration: 30,
    },
    {
        wave: 2,
        enemies: [
            { enemyId: 'basic', count: 15 },
            { enemyId: 'fast', count: 5 },
        ],
        spawnInterval: 1.2,
        duration: 40,
    },
    {
        wave: 3,
        enemies: [
            { enemyId: 'basic', count: 20 },
            { enemyId: 'fast', count: 10 },
            { enemyId: 'swarm', count: 10 },
        ],
        spawnInterval: 1.0,
        duration: 50,
    },
    {
        wave: 4,
        enemies: [
            { enemyId: 'basic', count: 25 },
            { enemyId: 'fast', count: 15 },
            { enemyId: 'tank', count: 3 },
        ],
        spawnInterval: 0.8,
        duration: 60,
    },
    {
        wave: 5,
        enemies: [
            { enemyId: 'basic', count: 30 },
            { enemyId: 'fast', count: 20 },
            { enemyId: 'tank', count: 5 },
            { enemyId: 'swarm', count: 20 },
        ],
        spawnInterval: 0.6,
        duration: 75,
    },
    {
        wave: 6,
        enemies: [
            { enemyId: 'basic', count: 40 },
            { enemyId: 'fast', count: 30 },
            { enemyId: 'tank', count: 8 },
            { enemyId: 'swarm', count: 30 },
        ],
        spawnInterval: 0.4,
        duration: 90,
    },
];
