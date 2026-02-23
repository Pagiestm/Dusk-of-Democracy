import * as pc from 'playcanvas';
import { CollisionLayer, COLLISION_PAIRS } from '../constants';
import { CollisionEntry } from '../types';

type CollisionCallback = (a: pc.Entity, b: pc.Entity, layerA: CollisionLayer, layerB: CollisionLayer) => void;

export class CollisionSystem {
    private entries: Map<number, CollisionEntry> = new Map();
    private grid: Map<string, CollisionEntry[]> = new Map();
    private cellSize: number = 4;
    private onCollision: CollisionCallback;
    private nextId: number = 0;

    constructor(onCollision: CollisionCallback) {
        this.onCollision = onCollision;
    }

    register(entity: pc.Entity, radius: number, layer: CollisionLayer): number {
        const id = this.nextId++;
        this.entries.set(id, { entity, radius, layer });
        (entity as any).__collisionId = id;
        return id;
    }

    unregister(entity: pc.Entity): void {
        const id = (entity as any).__collisionId;
        if (id !== undefined) {
            this.entries.delete(id);
            delete (entity as any).__collisionId;
        }
    }

    update(): void {
        // Rebuild spatial grid
        this.grid.clear();

        // Remove entries for destroyed entities
        for (const [id, entry] of this.entries) {
            if (!entry.entity.parent) {
                this.entries.delete(id);
                continue;
            }

            const pos = entry.entity.getPosition();
            const cellX = Math.floor(pos.x / this.cellSize);
            const cellZ = Math.floor(pos.z / this.cellSize);
            const key = `${cellX},${cellZ}`;

            let cell = this.grid.get(key);
            if (!cell) {
                cell = [];
                this.grid.set(key, cell);
            }
            cell.push(entry);
        }

        // Check collisions based on collision pairs
        for (const [layerA, layerB] of COLLISION_PAIRS) {
            this.checkLayerPair(layerA, layerB);
        }
    }

    private checkLayerPair(layerA: CollisionLayer, layerB: CollisionLayer): void {
        // Collect entities per layer
        const entitiesA: CollisionEntry[] = [];
        const entitiesB: CollisionEntry[] = [];

        for (const entry of this.entries.values()) {
            if (entry.layer === layerA) entitiesA.push(entry);
            if (entry.layer === layerB) entitiesB.push(entry);
        }

        // For each entity in layer A, check against nearby entities in layer B
        for (const a of entitiesA) {
            const posA = a.entity.getPosition();
            const cellX = Math.floor(posA.x / this.cellSize);
            const cellZ = Math.floor(posA.z / this.cellSize);

            // Check 3x3 cells around
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const key = `${cellX + dx},${cellZ + dz}`;
                    const cell = this.grid.get(key);
                    if (!cell) continue;

                    for (const b of cell) {
                        if (b.layer !== layerB) continue;
                        if (a.entity === b.entity) continue;

                        // Distance check
                        const posB = b.entity.getPosition();
                        const dx2 = posA.x - posB.x;
                        const dz2 = posA.z - posB.z;
                        const distSq = dx2 * dx2 + dz2 * dz2;
                        const radiusSum = a.radius + b.radius;

                        if (distSq < radiusSum * radiusSum) {
                            this.onCollision(a.entity, b.entity, a.layer, b.layer);
                        }
                    }
                }
            }
        }
    }

    clear(): void {
        this.entries.clear();
        this.grid.clear();
    }
}
