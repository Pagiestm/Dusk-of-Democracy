import * as pc from 'playcanvas';
import { CharacterDef } from '../types';

// Shared Mixamo animations (works for any character with mixamorig: skeleton)
const SHARED_ANIMS = {
    idle: 'assets/shared/idle.glb',
    run:  'assets/shared/running.glb',
    die:  'assets/shared/dying.glb',
};

export const CHARACTERS: CharacterDef[] = [
    {
        id: 'trump',
        name: 'Donald Trump',
        description: 'Make Surviving Great Again. PV élevés, vitesse lente.',
        hp: 150,
        speed: 7,
        color: new pc.Color(1, 0.6, 0.2), // orange
        modelPath: 'assets/trump/character.glb',
        animIdlePath: SHARED_ANIMS.idle,
        animRunPath: SHARED_ANIMS.run,
        animDiePath: SHARED_ANIMS.die,
    },
    {
        id: 'kirk',
        name: 'Charlie Kirk',
        description: 'Petite tête, gros dégâts. Rapide mais fragile.',
        hp: 80,
        speed: 10,
        color: new pc.Color(0.2, 0.4, 0.9), // blue
        modelPath: 'assets/kirk/character.glb',
        modelScale: 1,
        animIdlePath: 'assets/kirk/idle.glb',
        animRunPath: 'assets/kirk/running.glb',
        animDiePath: 'assets/kirk/dying.glb',
    },
    {
        id: 'maduro',
        name: 'Nicolas Maduro',
        description: 'Le chauffeur de bus de la destruction. Stats équilibrées.',
        hp: 120,
        speed: 8,
        color: new pc.Color(0.9, 0.2, 0.2), // red
        modelPath: 'assets/maduro/character.glb',
        modelScale: 1,
        // Static mesh (no skeleton) — animations not bound yet
    },
];

