import type { DrugCode, Lang, PushPayload } from './types';

const DRUG: Record<Lang, Record<DrugCode, string>> = {
  en: { P: 'paracetamol', M: 'morphine' },
  pl: { P: 'paracetamolu', M: 'morfiny' },
};

export function reminderPayload(lang: Lang, drug?: DrugCode): PushPayload {
  if (lang === 'pl') {
    return {
      title: 'Jak bardzo Cię teraz boli?',
      body: drug
        ? `Minęło 30 minut od podania ${DRUG.pl[drug]}. Dotknij, aby ocenić ból w skali od 0 do 10.`
        : 'Czas na ocenę bólu. Dotknij, aby ocenić ból w skali od 0 do 10.',
      url: '/',
      snoozeLabel: 'Za 10 min',
    };
  }
  return {
    title: 'How is your pain now?',
    body: drug
      ? `It’s been 30 minutes since your ${DRUG.en[drug]}. Tap to record your pain level from 0 to 10.`
      : 'It’s time for your pain check. Tap to record your pain level from 0 to 10.',
    url: '/',
    snoozeLabel: 'In 10 min',
  };
}
