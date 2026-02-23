import { PlayerStats } from '../types';

interface ShopItem {
    id: string;
    name: string;
    description: string;
    baseCost: number;
    apply: (stats: PlayerStats) => void;
}

interface ShopItemState {
    timesBought: number;
}

const PRICE_MULTIPLIER = 1.5; // +50% par achat

export class ShopSystem {
    gold: number = 0;

    private items: ShopItem[] = [
        {
            id: 'heal_potion',
            name: 'Potion de Soin',
            description: 'Restaure 50 PV',
            baseCost: 50,
            apply: (stats) => { stats.hp = Math.min(stats.hp + 50, stats.maxHp); },
        },
        {
            id: 'speed_boots',
            name: 'Bottes de Vitesse',
            description: '+10% Vitesse',
            baseCost: 100,
            apply: (stats) => { stats.speed *= 1.1; },
        },
        {
            id: 'armor_plate',
            name: 'Plaque de Blindage',
            description: '+10 Armure',
            baseCost: 150,
            apply: (stats) => { stats.armor += 10; },
        },
    ];

    private itemStates: Map<string, ShopItemState> = new Map();

    constructor() {
        this.resetItemStates();
    }

    private resetItemStates(): void {
        this.itemStates.clear();
        for (const item of this.items) {
            this.itemStates.set(item.id, { timesBought: 0 });
        }
    }

    /** Prix actuel avec inflation */
    getItemCost(itemId: string): number {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return 0;
        const state = this.itemStates.get(itemId);
        const timesBought = state?.timesBought ?? 0;
        return Math.ceil(item.baseCost * Math.pow(PRICE_MULTIPLIER, timesBought));
    }

    addGold(amount: number): void {
        this.gold += amount;
    }

    getItems(): { id: string; name: string; description: string; cost: number }[] {
        return this.items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            cost: this.getItemCost(item.id),
        }));
    }

    canBuy(itemId: string): boolean {
        return this.gold >= this.getItemCost(itemId);
    }

    buy(itemId: string, stats: PlayerStats): boolean {
        const item = this.items.find(i => i.id === itemId);
        const cost = this.getItemCost(itemId);
        if (!item || this.gold < cost) return false;

        this.gold -= cost;
        item.apply(stats);

        // Augmenter le prix pour le prochain achat
        const state = this.itemStates.get(itemId);
        if (state) state.timesBought++;

        return true;
    }

    reset(): void {
        this.gold = 0;
        this.resetItemStates();
    }
}
