import * as pc from 'playcanvas';
import { CharacterDef } from '../types';

export const CHARACTERS: CharacterDef[] = [
    {
        id: 'trump',
        name: 'Donald Trump',
        description: 'Make Surviving Great Again. PV élevés, vitesse lente.',
        hp: 150,
        speed: 7,
        color: new pc.Color(1, 0.6, 0.2), // orange
        modelPath: 'assets/models/lowpoly_trump_free_character.glb',
    },
    {
        id: 'kirk',
        name: 'Charlie Kirk',
        description: 'Petite tête, gros dégâts. Rapide mais fragile.',
        hp: 80,
        speed: 10,
        color: new pc.Color(0.2, 0.4, 0.9), // blue
    },
    {
        id: 'maduro',
        name: 'Nicolas Maduro',
        description: 'Le chauffeur de bus de la destruction. Stats équilibrées.',
        hp: 120,
        speed: 8,
        color: new pc.Color(0.9, 0.2, 0.2), // red
    },
];

