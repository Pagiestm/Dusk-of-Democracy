import { UpgradeDef, PlayerStats } from '../types';

export const UPGRADES: UpgradeDef[] = [
    {
        id: 'max_hp_up',
        name: 'Thick Skin',
        description: '+25 Max HP',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.maxHp += 25;
            stats.hp += 25;
        },
    },
    {
        id: 'speed_up',
        name: 'Fast Feet',
        description: '+15% Speed',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.speed *= 1.15;
        },
    },
    {
        id: 'damage_up',
        name: 'Big Hands',
        description: '+20% Damage',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.damage *= 1.20;
        },
    },
    {
        id: 'cooldown_down',
        name: 'Rapid Fire',
        description: '-10% Weapon Cooldown',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.cooldownMultiplier *= 0.90;
        },
    },
    {
        id: 'magnet_up',
        name: 'XP Magnet',
        description: '+50% Pickup Radius',
        maxLevel: 3,
        apply: (stats: PlayerStats) => {
            stats.magnetRadius *= 1.5;
        },
    },
    {
        id: 'armor_up',
        name: 'Body Armor',
        description: '+5 Armor (flat damage reduction)',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.armor += 5;
        },
    },
    {
        id: 'extra_projectile',
        name: 'Double Tap',
        description: '+1 Projectile per attack',
        maxLevel: 3,
        apply: (stats: PlayerStats) => {
            stats.projectileCount += 1;
        },
    },
    {
        id: 'heal',
        name: 'First Aid',
        description: 'Restore 30 HP',
        maxLevel: 99,
        apply: (stats: PlayerStats) => {
            stats.hp = Math.min(stats.hp + 30, stats.maxHp);
        },
    },
];
