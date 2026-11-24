import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('store', () => {
  beforeEach(() => window.localStorage.clear());

  it('seeds sample data when storage is empty', () => {
    expect(createStore(window.localStorage).getSnapshot().readings.length).toBe(26);
  });

  it('persists a new reading and notifies subscribers', () => {
    const s = createStore(window.localStorage, () => 1000);
    const l = vi.fn();
    s.subscribe(l);
    s.addReading(7, 5000);
    expect(l).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().readings.at(-1)).toMatchObject({ level: 7, at: 5000 });
    expect(createStore(window.localStorage).getSnapshot().readings.at(-1)?.level).toBe(7);
  });

  it('rejects invalid levels', () => {
    const s = createStore(window.localStorage);
    expect(() => s.addReading(11)).toThrow(RangeError);
    expect(() => s.addReading(2.5)).toThrow(RangeError);
  });

  it('recovers from corrupt storage', () => {
    window.localStorage.setItem('painApp.data.v1', '{nope');
    expect(createStore(window.localStorage).getSnapshot().readings.length).toBe(26);
  });
});
