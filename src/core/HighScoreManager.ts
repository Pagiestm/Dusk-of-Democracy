export interface HighScoreEntry {
    score: number;
    wave: number;
    kills: number;
    time: number;
    level: number;
    characterId: string;
    weaponId: string;
    date: string;
}

const STORAGE_KEY = 'dod_highscores';
const MAX_ENTRIES = 10;

export class HighScoreManager {
    static computeScore(wave: number, kills: number, time: number): number {
        return wave * 10000 + kills * 10 + Math.floor(time);
    }

    static getAll(): HighScoreEntry[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) return [];
            return data;
        } catch {
            return [];
        }
    }

    static save(entry: Omit<HighScoreEntry, 'score' | 'date'>): HighScoreEntry {
        const score = this.computeScore(entry.wave, entry.kills, entry.time);
        const newEntry: HighScoreEntry = {
            ...entry,
            score,
            date: new Date().toISOString(),
        };

        const list = this.getAll();
        list.push(newEntry);
        list.sort((a, b) => b.score - a.score);
        const top = list.slice(0, MAX_ENTRIES);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(top));
        } catch (e) {
            console.warn('Failed to save highscore:', e);
        }

        return newEntry;
    }

    static clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
    }

    /** Returns the rank (1-based) of the given score in the top list, or -1 if not in top */
    static getRank(score: number): number {
        const list = this.getAll();
        const idx = list.findIndex(e => e.score === score);
        return idx === -1 ? -1 : idx + 1;
    }
}
