import * as pc from 'playcanvas';

const loadedAssets: Map<string, pc.Asset> = new Map();

export async function loadGlbModel(app: pc.Application, path: string): Promise<pc.Asset> {
    const cached = loadedAssets.get(path);
    if (cached) return cached;

    return new Promise((resolve, reject) => {
        const asset = new pc.Asset(path, 'container', { url: path });
        asset.on('load', () => {
            loadedAssets.set(path, asset);
            resolve(asset);
        });
        asset.on('error', (err: string) => {
            reject(new Error(`Failed to load ${path}: ${err}`));
        });
        app.assets.add(asset);
        app.assets.load(asset);
    });
}

export async function preloadModels(app: pc.Application, paths: string[]): Promise<void> {
    await Promise.all(paths.map(p => loadGlbModel(app, p)));
}

export function getCachedModel(path: string): pc.Asset | undefined {
    return loadedAssets.get(path);
}
