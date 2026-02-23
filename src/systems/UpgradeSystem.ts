import { UPGRADES } from '../data/upgrades';
import { UpgradeDef, PlayerStats } from '../types';

export class UpgradeSystem {
    private upgradeLevels: Map<string, number> = new Map();

    getRandomUpgrades(count: number): UpgradeDef[] {
        // Filter upgrades that aren't maxed
        const available = UPGRADES.filter(u => {
            const currentLevel = this.upgradeLevels.get(u.id) || 0;
            return currentLevel < u.maxLevel;
        });

        // Shuffle and take count
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    applyUpgrade(upgradeId: string, stats: PlayerStats): void {
        const upgrade = UPGRADES.find(u => u.id === upgradeId);
        if (!upgrade) return;

        const currentLevel = this.upgradeLevels.get(upgradeId) || 0;
        if (currentLevel >= upgrade.maxLevel) return;

        upgrade.apply(stats);
        this.upgradeLevels.set(upgradeId, currentLevel + 1);
    }

    getUpgradeLevel(upgradeId: string): number {
        return this.upgradeLevels.get(upgradeId) || 0;
    }

    reset(): void {
        this.upgradeLevels.clear();
    }
}
