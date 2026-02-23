import * as pc from 'playcanvas';
import { CharacterDef } from '../types';

export const CHARACTERS: CharacterDef[] = [
    {
        id: 'trump',
        name: 'Donald Trump',
        description: 'Make Surviving Great Again. High HP, slow speed.',
        hp: 150,
        speed: 7,
        startingWeaponId: 'executive_order',
        color: new pc.Color(1, 0.6, 0.2), // orange
    },
    {
        id: 'kirk',
        name: 'Charlie Kirk',
        description: 'Small face, big damage. Fast but fragile.',
        hp: 80,
        speed: 10,
        startingWeaponId: 'tweet_storm',
        color: new pc.Color(0.2, 0.4, 0.9), // blue
    },
    {
        id: 'maduro',
        name: 'Nicolas Maduro',
        description: 'The bus driver of destruction. Balanced stats.',
        hp: 120,
        speed: 8,
        startingWeaponId: 'bolivarian_blast',
        color: new pc.Color(0.9, 0.2, 0.2), // red
    },
];
