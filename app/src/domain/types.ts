export type PainLevel = number; // integer 0..10
export type DrugCode = 'P' | 'M';
export type Lang = 'en' | 'pl';

/** A pain level reported by the patient. `at` is epoch milliseconds. */
export interface Reading {
  id: string;
  at: number;
  level: PainLevel;
}

/** A medication dose given by staff. `at` is epoch milliseconds. */
export interface Dose {
  id: string;
  at: number;
  drug: DrugCode;
  /** Staff identifier, e.g. "214". */
  by: string;
}

export interface PatientData {
  readings: Reading[];
  doses: Dose[];
}
