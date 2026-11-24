import { ACCEPTABLE_MAX } from './painScale';
import type { Dose, PatientData, Reading } from './types';

const MIN = 60_000;
/** A reading counts as "before" a dose if taken within this window. */
const BEFORE_WINDOW = 60 * MIN;
/** The first reading after a dose counts as its effect if within this window. */
const AFTER_WINDOW = 45 * MIN;
/** Above-threshold pain is answered if a dose follows within this window. */
const RESPONSE_WINDOW = 60 * MIN;

export interface DoseView {
  dose: Dose;
  before: Reading | null;
  after: Reading | null;
  /** Minutes from an above-threshold reading to this dose; null for scheduled doses. */
  responseMin: number | null;
  /** after.level - before.level; null if either is missing. */
  change: number | null;
}

export interface ReadingView {
  reading: Reading;
  /** Dose whose "after" reading this is. */
  postDose: DoseView | null;
  /** First dose within the response window after an above-threshold reading. */
  nextDose: DoseView | null;
}

export interface DayModel {
  /** Local midnight, epoch ms. */
  start: number;
  readings: ReadingView[];
  doses: DoseView[];
  avg: number;
}

export interface Spike {
  reading: Reading;
  dayIndex: number;
  followUp: DoseView | null;
}

export interface DrugSummary {
  drug: Dose['drug'];
  doses: number;
  avgChange: number;
  okAfter: number;
}

export interface HistoryModel {
  days: DayModel[];
  readingCount: number;
  avg: number;
  okCount: number;
  /** Mean minutes from above-threshold pain to dose; null when none. */
  avgResponseMin: number | null;
  /** Above-threshold readings with no dose within the response window. */
  unanswered: number;
  avgChange: number;
  changeCount: number;
  downCount: number;
  spike: Spike | null;
  perDrug: DrugSummary[];
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function buildDay(start: number, readings: Reading[], doses: Dose[]): DayModel {
  const doseViews: DoseView[] = doses.map((dose) => {
    let before: Reading | null = null;
    let after: Reading | null = null;
    for (const r of readings) {
      if (r.at <= dose.at && dose.at - r.at <= BEFORE_WINDOW) before = r;
      if (!after && r.at > dose.at && r.at - dose.at <= AFTER_WINDOW) after = r;
    }
    return {
      dose,
      before,
      after,
      responseMin: before && before.level > ACCEPTABLE_MAX ? Math.round((dose.at - before.at) / MIN) : null,
      change: before && after ? after.level - before.level : null,
    };
  });

  const readingViews: ReadingView[] = readings.map((reading) => ({
    reading,
    postDose: doseViews.find((d) => d.after === reading) ?? null,
    nextDose: doseViews.find((d) => d.dose.at > reading.at && d.dose.at - reading.at <= RESPONSE_WINDOW) ?? null,
  }));

  return { start, readings: readingViews, doses: doseViews, avg: mean(readings.map((r) => r.level)) };
}

/** Pure derivation of everything the History screen shows. */
export function computeHistory(data: PatientData): HistoryModel {
  const readings = [...data.readings].sort((a, b) => a.at - b.at);
  const doses = [...data.doses].sort((a, b) => a.at - b.at);

  const starts = [...new Set([...readings, ...doses].map((e) => startOfDay(e.at)))].sort((a, b) => a - b);
  const days = starts.map((start) =>
    buildDay(
      start,
      readings.filter((r) => startOfDay(r.at) === start),
      doses.filter((d) => startOfDay(d.at) === start),
    ),
  );

  const allReadings = days.flatMap((d) => d.readings);
  const allDoses = days.flatMap((d) => d.doses);

  const above = allReadings.filter((r) => r.reading.level > ACCEPTABLE_MAX);
  const unanswered = above.filter((r) => !r.nextDose).length;
  const responses = allDoses.flatMap((d) => (d.responseMin != null ? [d.responseMin] : []));
  const changes = allDoses.flatMap((d) => (d.change != null ? [d.change] : []));

  let spike: Spike | null = null;
  days.forEach((day, dayIndex) => {
    for (const rv of day.readings) {
      if (!spike || rv.reading.level > spike.reading.level) {
        spike = { reading: rv.reading, dayIndex, followUp: rv.nextDose };
      }
    }
  });

  const drugs = [...new Set(allDoses.map((d) => d.dose.drug))];
  const perDrug = drugs.map<DrugSummary>((drug) => {
    const ds = allDoses.filter((d) => d.dose.drug === drug);
    return {
      drug,
      doses: ds.length,
      avgChange: mean(ds.flatMap((d) => (d.change != null ? [d.change] : []))),
      okAfter: ds.filter((d) => d.after && d.after.level <= ACCEPTABLE_MAX).length,
    };
  });

  return {
    days,
    readingCount: allReadings.length,
    avg: mean(allReadings.map((r) => r.reading.level)),
    okCount: allReadings.filter((r) => r.reading.level <= ACCEPTABLE_MAX).length,
    avgResponseMin: responses.length ? Math.round(mean(responses)) : null,
    unanswered,
    avgChange: mean(changes),
    changeCount: changes.length,
    downCount: changes.filter((c) => c < 0).length,
    spike,
    perDrug,
  };
}
