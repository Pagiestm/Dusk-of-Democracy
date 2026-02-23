import * as pc from 'playcanvas';
import { EnemyDef } from '../types';

export const ENEMIES: EnemyDef[] = [
    {
        id: 'basic',
        name: 'Protestor',
        hp: 20,
        speed: 3,
        damage: 10,
        xpReward: 10,
        color: new pc.Color(0.8, 0.2, 0.3),
        scale: 0.8,
    },
    {
        id: 'fast',
        name: 'Journalist',
        hp: 10,
        speed: 6,
        damage: 5,
        xpReward: 15,
        color: new pc.Color(0.9, 0.9, 0.2),
        scale: 0.6,
    },
    {
        id: 'tank',
        name: 'Activist',
        hp: 80,
        speed: 1.5,
        damage: 25,
        xpReward: 30,
        color: new pc.Color(0.5, 0.2, 0.7),
        scale: 1.2,
    },
    {
        id: 'swarm',
        name: 'Twitter Bot',
        hp: 5,
        speed: 5,
        damage: 3,
        xpReward: 5,
        color: new pc.Color(0.3, 0.7, 0.9),
        scale: 0.5,
    },
];
