import * as pc from 'playcanvas';
import { GameState } from '../constants';

export class Health extends pc.Script {
    static scriptName = 'health';

    maxHp: number = 100;
    hp: number = 100;
    private invulnTimer: number = 0;
    invulnDuration: number = 0; // seconds of invulnerability after hit (0 = none)

    initialize(): void {
        this.hp = this.maxHp;
    }

    update(dt: number): void {
        const game = (this.app as any).__game;
        if (game && game.state !== GameState.PLAYING) return;

        if (this.invulnTimer > 0) {
            this.invulnTimer -= dt;
        }
    }

    takeDamage(amount: number, armorHit: boolean = false): void {
        if (this.invulnTimer > 0) return;

        this.hp -= amount;

        if (this.invulnDuration > 0) {
            this.invulnTimer = this.invulnDuration;
        }

        this.flashDamage(armorHit);
        this.app.fire('damage:dealt', this.entity, amount, armorHit);

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    heal(amount: number): void {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    private flashDamage(armorAbsorbed: boolean): void {
        // Collect mesh instances from this entity AND all descendants
        const meshInstances: pc.MeshInstance[] = [];
        this.entity.forEach((node: pc.GraphNode) => {
            const e = node as pc.Entity;
            if (e.render && e.render.meshInstances.length > 0) {
                meshInstances.push(...e.render.meshInstances);
            }
        });

        if (meshInstances.length === 0) return;

        const originalMaterials = meshInstances.map(mi => mi.material);

        const flashMat = new pc.StandardMaterial();
        if (armorAbsorbed) {
            // Flash bleu/gris pour armure
            flashMat.diffuse = new pc.Color(0.3, 0.4, 0.8);
            flashMat.emissive = new pc.Color(0.05, 0.1, 0.3);
        } else {
            // Flash rouge classique
            flashMat.diffuse = new pc.Color(0.8, 0.1, 0.1);
            flashMat.emissive = new pc.Color(0.15, 0, 0);
        }
        flashMat.update();

        for (const mi of meshInstances) {
            mi.material = flashMat;
        }

        setTimeout(() => {
            meshInstances.forEach((mi, i) => {
                if (originalMaterials[i]) {
                    mi.material = originalMaterials[i];
                }
            });
        }, 100);
    }

    private die(): void {
        this.app.fire('entity:died', this.entity);

        // Check if it's the player
        if (this.entity.tags.has('player')) {
            this.app.fire('player:died');
        } else if (this.entity.tags.has('enemy')) {
            // Get xpReward from entity data
            const xpReward = (this.entity as any).__xpReward || 10;
            this.app.fire('enemy:died', this.entity, xpReward);
        }
    }
}
