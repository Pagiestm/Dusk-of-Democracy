import { UpgradeDef, PlayerStats } from '../types';

export const UPGRADES: UpgradeDef[] = [
    {
        id: 'max_hp_up',
        name: 'Peau Epaisse',
        description: '+25 PV max',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.maxHp += 25;
            stats.hp += 25;
        },
    },
    {
        id: 'speed_up',
        name: 'Pieds Legers',
        description: '+15% Vitesse',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.speed *= 1.15;
        },
    },
    {
        id: 'damage_up',
        name: 'Grosses Mains',
        description: '+20% Degats',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.damage *= 1.20;
        },
    },
    {
        id: 'cooldown_down',
        name: 'Tir Rapide',
        description: '-10% Temps de recharge',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.cooldownMultiplier *= 0.90;
        },
    },
    {
        id: 'magnet_up',
        name: 'Aimant a XP',
        description: '+50% Rayon de collecte',
        maxLevel: 3,
        apply: (stats: PlayerStats) => {
            stats.magnetRadius *= 1.5;
        },
    },
    {
        id: 'armor_up',
        name: 'Gilet Pare-balles',
        description: '+5 Armure (reduction de degats)',
        maxLevel: 5,
        apply: (stats: PlayerStats) => {
            stats.armor += 5;
        },
    },
    {
        id: 'extra_projectile',
        name: 'Double Tir',
        description: '+1 Projectile par attaque',
        maxLevel: 3,
        apply: (stats: PlayerStats) => {
            stats.projectileCount += 1;
        },
    },
    {
        id: 'heal',
        name: 'Premiers Soins',
        description: 'Restaure 30 PV',
        maxLevel: 99,
        apply: (stats: PlayerStats) => {
            stats.hp = Math.min(stats.hp + 30, stats.maxHp);
        },
    },
];
