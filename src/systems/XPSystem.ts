import * as pc from 'playcanvas';
import { XP_BASE_PER_LEVEL } from '../constants';
import { createXPPickup } from '../entities/PickupFactory';

export class XPSystem {
    private app: pc.Application;

    totalXP: number = 0;
    currentLevel: number = 1;
    xpForNextLevel: number = XP_BASE_PER_LEVEL;
    xpInCurrentLevel: number = 0;

    constructor(app: pc.Application) {
        this.app = app;

        // When enemy dies, spawn XP pickup at their position
        this.app.on('enemy:died', (entity: pc.Entity, xpReward: number) => {
            const pos = entity.getPosition();
            createXPPickup(this.app, pos.clone(), xpReward);
        });

        // When XP pickup is collected
        this.app.on('xp:collected', (amount: number) => {
            this.addXP(amount);
        });
    }

    addXP(amount: number): void {
        this.totalXP += amount;
        this.xpInCurrentLevel += amount;

        // Check for level up
        while (this.xpInCurrentLevel >= this.xpForNextLevel) {
            this.xpInCurrentLevel -= this.xpForNextLevel;
            this.currentLevel++;
            this.xpForNextLevel = this.currentLevel * XP_BASE_PER_LEVEL;

            this.app.fire('player:levelup', this.currentLevel);
        }
    }

    getProgress(): number {
        return this.xpForNextLevel > 0 ? this.xpInCurrentLevel / this.xpForNextLevel : 0;
    }

    reset(): void {
        this.totalXP = 0;
        this.currentLevel = 1;
        this.xpForNextLevel = XP_BASE_PER_LEVEL;
        this.xpInCurrentLevel = 0;
    }
}
