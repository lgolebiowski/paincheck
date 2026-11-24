import type { Dose, DrugCode, PatientData, Reading } from './types';

type Day = { readings: [string, number][]; doses: [string, DrugCode, string][] };

const REGULAR: Day['doses'] = [['08:00', 'P', '214'], ['14:00', 'P', '108'], ['20:00', 'P', '331']];

/** Sample data from the design prototype: 16–19 Nov 2026 (months are 0-based). */
const DAYS: { date: [number, number, number]; day: Day }[] = [
  { date: [2026, 10, 16], day: { readings: [['07:40', 5], ['08:30', 3], ['13:40', 5], ['14:30', 3], ['19:40', 5], ['20:30', 4]], doses: REGULAR } },
  { date: [2026, 10, 17], day: { readings: [['07:40', 4], ['08:30', 2], ['13:40', 5], ['14:30', 3], ['19:40', 4], ['20:30', 3]], doses: REGULAR } },
  {
    date: [2026, 10, 18],
    day: {
      readings: [['07:40', 4], ['08:30', 2], ['11:20', 6], ['12:05', 3], ['13:40', 4], ['14:30', 2], ['19:40', 4], ['20:30', 4]],
      doses: [['08:00', 'P', '214'], ['11:35', 'M', '108'], ['14:00', 'P', '108'], ['20:00', 'P', '331']],
    },
  },
  { date: [2026, 10, 19], day: { readings: [['07:40', 3], ['08:30', 2], ['13:40', 3], ['14:30', 1], ['19:40', 3], ['20:30', 2]], doses: REGULAR } },
];

function at([y, m, d]: [number, number, number], hhmm: string): number {
  const [h = 0, min = 0] = hhmm.split(':').map(Number);
  return new Date(y, m, d, h, min).getTime();
}

export function sampleData(): PatientData {
  const readings: Reading[] = [];
  const doses: Dose[] = [];
  for (const { date, day } of DAYS) {
    for (const [time, level] of day.readings) {
      readings.push({ id: `seed-r-${date[2]}-${time}`, at: at(date, time), level });
    }
    for (const [time, drug, by] of day.doses) {
      doses.push({ id: `seed-d-${date[2]}-${time}`, at: at(date, time), drug, by });
    }
  }
  return { readings, doses };
}
