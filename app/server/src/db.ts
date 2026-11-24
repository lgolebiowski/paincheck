import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Db } from './types';

export interface DbStore {
  get(): Db;
  save(): void;
}

const empty = (): Db => ({ subscriptions: [], reminders: [] });

/** In-memory object persisted atomically to a JSON file. Pass null path for memory-only (tests). */
export function createDbStore(path: string | null): DbStore {
  let db = empty();
  if (path) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Db>;
      db = {
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
        reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      };
    } catch {
      // Missing or corrupt file: start empty.
    }
  }
  return {
    get: () => db,
    save() {
      if (!path) return;
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(db, null, 2));
      renameSync(tmp, path);
    },
  };
}
