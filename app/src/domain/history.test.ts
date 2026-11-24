import { describe, expect, it } from 'vitest';
import { computeHistory } from './history';
import { sampleData } from './seed';
import type { PatientData } from './types';

const T = (h: number, m = 0) => new Date(2026, 10, 18, h, m).getTime();

describe('computeHistory on the prototype sample data', () => {
  const m = computeHistory(sampleData());

  it('groups readings into 4 days', () => {
    expect(m.days).toHaveLength(4);
    expect(m.readingCount).toBe(26);
  });

  it('finds the spike to 6 followed by morphine after 15 min', () => {
    expect(m.spike?.reading.level).toBe(6);
    expect(m.spike?.followUp?.dose.drug).toBe('M');
    expect(m.spike?.followUp?.responseMin).toBe(15);
    expect(m.spike?.followUp?.after?.level).toBe(3);
  });

  it('computes per-drug summaries', () => {
    const p = m.perDrug.find((d) => d.drug === 'P')!;
    const mo = m.perDrug.find((d) => d.drug === 'M')!;
    expect(p.doses).toBe(12);
    expect(mo.doses).toBe(1);
    expect(mo.avgChange).toBe(-3);
  });

  it('counts the two 20:30 readings of 4 (16th and 18th) as unanswered, as in the prototype', () => {
    expect(m.unanswered).toBe(2);
  });
});

describe('computeHistory edge cases', () => {
  it('handles empty data', () => {
    const m = computeHistory({ readings: [], doses: [] });
    expect(m.days).toEqual([]);
    expect(m.spike).toBeNull();
    expect(m.avgResponseMin).toBeNull();
  });

  it('counts above-threshold pain without a dose within 60 min as unanswered', () => {
    const data: PatientData = {
      readings: [{ id: 'a', at: T(9), level: 7 }, { id: 'b', at: T(12), level: 5 }],
      doses: [{ id: 'd', at: T(12, 30), drug: 'P', by: '1' }],
    };
    const m = computeHistory(data);
    expect(m.unanswered).toBe(1);
    expect(m.spike?.followUp).toBeNull();
    expect(m.avgResponseMin).toBe(30);
  });

  it('ignores a follow-up reading more than 45 min after the dose', () => {
    const m = computeHistory({
      readings: [{ id: 'a', at: T(9), level: 5 }, { id: 'b', at: T(10), level: 2 }],
      doses: [{ id: 'd', at: T(9, 10), drug: 'P', by: '1' }],
    });
    expect(m.days[0]!.doses[0]!.after).toBeNull();
    expect(m.changeCount).toBe(0);
  });

  it('treats a dose after acceptable pain as scheduled (no response time)', () => {
    const m = computeHistory({
      readings: [{ id: 'a', at: T(9), level: 3 }],
      doses: [{ id: 'd', at: T(9, 10), drug: 'P', by: '1' }],
    });
    expect(m.days[0]!.doses[0]!.responseMin).toBeNull();
  });
});
