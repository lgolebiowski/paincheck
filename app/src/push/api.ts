import type { DrugCode } from '../domain/types';

/** Fire-and-forget calls to the reminder server. Failures are swallowed: the app works offline-first. */
async function post(path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return null;
  }
}

export const reportDose = (drug: DrugCode, at: number) => post('/api/doses', { drug, at });
export const reportReading = () => post('/api/readings');
export const sendTestPush = () => post('/api/push/test');
