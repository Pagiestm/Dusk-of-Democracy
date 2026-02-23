import * as pc from 'playcanvas';

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
        if (this.invulnTimer > 0) {
            this.invulnTimer -= dt;
        }
    }

    takeDamage(amount: number, armor: number = 0): void {
        if (this.invulnTimer > 0) return;

        const finalDamage = Math.max(1, amount - armor);
        this.hp -= finalDamage;

        if (this.invulnDuration > 0) {
            this.invulnTimer = this.invulnDuration;
        }

        // Flash red effect
        this.flashDamage();

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    heal(amount: number): void {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    private flashDamage(): void {
        // Collect mesh instances from this entity AND all descendants (GLB models
        // attach render components on child entities, not the root player entity).
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
        flashMat.diffuse = new pc.Color(0.8, 0.1, 0.1);
        flashMat.emissive = new pc.Color(0.15, 0, 0);
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
