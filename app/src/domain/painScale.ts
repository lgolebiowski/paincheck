import type { PainLevel } from './types';

/** Level at or below which pain counts as acceptable. */
export const ACCEPTABLE_MAX = 3;

/** Index into the 5 localized pain labels. */
export type PainCategory = 0 | 1 | 2 | 3 | 4;

export function painCategory(level: PainLevel): PainCategory {
  if (level === 0) return 0;
  if (level <= 3) return 1;
  if (level <= 6) return 2;
  if (level <= 9) return 3;
  return 4;
}

const COLORS: readonly (readonly [bg: string, fg: string])[] = [
  ['#166534', '#ffffff'], ['#15803d', '#ffffff'], ['#22c55e', '#052e16'], ['#84cc16', '#1a2e05'],
  ['#a3e635', '#1a2e05'], ['#facc15', '#422006'], ['#fbbf24', '#451a03'], ['#fb923c', '#431407'],
  ['#f97316', '#431407'], ['#dc2626', '#ffffff'], ['#991b1b', '#ffffff'],
];

export function painColors(level: PainLevel): { bg: string; fg: string } {
  const c = COLORS[Math.max(0, Math.min(10, Math.round(level)))] ?? COLORS[0]!;
  return { bg: c[0], fg: c[1] };
}

export const PAIN_LEVELS: readonly PainLevel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const DRUG_COLORS = { P: '#1d4ed8', M: '#7e22ce' } as const;
