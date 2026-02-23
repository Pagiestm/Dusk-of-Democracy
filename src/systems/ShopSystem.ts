import { PlayerStats } from '../types';

interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    apply: (stats: PlayerStats) => void;
}

export class ShopSystem {
    gold: number = 0;

    private items: ShopItem[] = [
        {
            id: 'heal_potion',
            name: 'Heal Potion',
            description: 'Restore 50 HP',
            cost: 50,
            apply: (stats) => { stats.hp = Math.min(stats.hp + 50, stats.maxHp); },
        },
        {
            id: 'speed_boots',
            name: 'Speed Boots',
            description: '+10% Speed',
            cost: 100,
            apply: (stats) => { stats.speed *= 1.1; },
        },
        {
            id: 'armor_plate',
            name: 'Armor Plate',
            description: '+10 Armor',
            cost: 150,
            apply: (stats) => { stats.armor += 10; },
        },
    ];

    addGold(amount: number): void {
        this.gold += amount;
    }

    getItems(): ShopItem[] {
        return this.items;
    }

    canBuy(itemId: string): boolean {
        const item = this.items.find(i => i.id === itemId);
        return item ? this.gold >= item.cost : false;
    }

    buy(itemId: string, stats: PlayerStats): boolean {
        const item = this.items.find(i => i.id === itemId);
        if (!item || this.gold < item.cost) return false;

        this.gold -= item.cost;
        item.apply(stats);
        return true;
    }

    reset(): void {
        this.gold = 0;
    }
}
