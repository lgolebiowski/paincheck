import type { DrugCode, Lang, PushPayload } from './types';

const DRUG: Record<Lang, Record<DrugCode, string>> = {
  en: { P: 'paracetamol', M: 'morphine' },
  pl: { P: 'paracetamolu', M: 'morfiny' },
};

/** Builds the localized reminder. `delayMs` is the real dose→reminder delay, so the text never lies about it. */
export function reminderPayload(lang: Lang, drug: DrugCode | undefined, delayMs: number): PushPayload {
  const minutes = Math.round(delayMs / 60_000);
  const tap = lang === 'pl' ? 'Dotknij, aby ocenić ból w skali od 0 do 10.' : 'Tap to record your pain level from 0 to 10.';
  let body: string;
  if (lang === 'pl') {
    body = !drug ? `Czas na ocenę bólu. ${tap}`
      : minutes >= 1 ? `Minęło ${minutes} min od podania ${DRUG.pl[drug]}. ${tap}`
      : `Czas na ocenę bólu po podaniu ${DRUG.pl[drug]}. ${tap}`;
  } else {
    body = !drug ? `It’s time for your pain check. ${tap}`
      : minutes >= 1 ? `It’s been ${minutes} minutes since your ${DRUG.en[drug]}. ${tap}`
      : `It’s time for your pain check after your ${DRUG.en[drug]}. ${tap}`;
  }
  return {
    title: lang === 'pl' ? 'Jak bardzo Cię teraz boli?' : 'How is your pain now?',
    body,
    url: '/',
    snoozeLabel: lang === 'pl' ? 'Za 10 min' : 'In 10 min',
  };
}
