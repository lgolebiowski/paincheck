import { sampleData } from '../domain/seed';
import type { Dose, DrugCode, PainLevel, PatientData } from '../domain/types';

const KEY = 'painApp.data.v1';

export interface Store {
  getSnapshot(): PatientData;
  subscribe(listener: () => void): () => void;
  addReading(level: PainLevel, at?: number): void;
  addDose(drug: DrugCode, by: string, at?: number): void;
  resetToSample(): void;
}

function isData(x: unknown): x is PatientData {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.readings) && Array.isArray(o.doses);
}

function load(storage: Storage): PatientData {
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isData(parsed)) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage: fall back to sample data below.
  }
  return sampleData();
}

/** localStorage-backed store. Immutable snapshots, so it works with useSyncExternalStore. */
export function createStore(storage: Storage = window.localStorage, now: () => number = Date.now): Store {
  let data = load(storage);
  const listeners = new Set<() => void>();
  let seq = 0;

  function commit(next: PatientData): void {
    data = next;
    try {
      storage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage full/blocked: keep in-memory state so the session still works.
    }
    listeners.forEach((l) => l());
  }

  const newId = (p: string) => `${p}-${now()}-${seq++}`;

  return {
    getSnapshot: () => data,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addReading(level, at = now()) {
      if (!Number.isInteger(level) || level < 0 || level > 10) throw new RangeError(`Invalid pain level: ${level}`);
      commit({ ...data, readings: [...data.readings, { id: newId('r'), at, level }] });
    },
    addDose(drug, by, at = now()) {
      const dose: Dose = { id: newId('d'), at, drug, by };
      commit({ ...data, doses: [...data.doses, dose] });
    },
    resetToSample() {
      commit(sampleData());
    },
  };
}
