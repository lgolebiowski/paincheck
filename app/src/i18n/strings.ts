import type { DrugCode, Lang } from '../domain/types';

export interface Strings {
  locale: string;
  common: { langLabel: string; viewHistory: string; back: string };
  pick: { title: string; sub: string; painLevel: string };
  confirm: { title: string; youChose: string; yes: string; no: string };
  saved: { thanks: string; recorded: string; recordedAt: string; done: string };
  push: {
    enable: string; disable: string; on: string; off: string; denied: string; unsupported: string;
    error: string; test: string; iosHint: string;
  };
  history: {
    title: string; patient: string; sample: string; range: string;
    sAvg: string; sOk: string; sResp: string; sChange: string;
    trend: string; ok: string; resp: string; change: string;
    spikeTitle: string; spikeText: string; spikeNoDose: string;
    chartTitle: string; chartHint: string; legendOk: string;
    tReported: string; tOk: string; tNoDose: string; tNext: string; tPost: string; tBy: string;
    tBefore: string; tResp: string; tScheduled: string; tAfter: string; tConfirmed: string;
    chartAria: string; byDrug: string; drugLine: string;
    logTitle: string; dayFilter: string; all: string;
    pain: string; afterDose: string; respAfter: string; scheduled: string; confirmed: string; staff: string;
    empty: string;
    staffTitle: string; staffHint: string; staffGive: string; staffId: string; resetSample: string;
  };
  labels: [string, string, string, string, string];
  descs: [string, string, string, string, string];
  drugs: Record<DrugCode, { name: string; dose: string; route: string }>;
  doseWord: (n: number) => string;
}

const en: Strings = {
  locale: 'en-AU',
  common: { langLabel: 'Language', viewHistory: 'View history', back: 'Back to pain check' },
  pick: {
    title: 'How much pain are you in right now?',
    sub: 'Tap one number. 0 is no pain, 10 is the worst pain possible.',
    painLevel: 'Pain level',
  },
  confirm: { title: 'Are you sure?', youChose: 'You chose pain level', yes: 'Yes', no: 'No' },
  saved: { thanks: 'Thank you', recorded: 'Your pain level has been recorded.', recordedAt: 'Recorded at', done: 'Done' },
  push: {
    enable: 'Turn on reminders', disable: 'Turn off', on: 'Reminders are on', off: 'Reminders are off',
    denied: 'Notifications are blocked in your browser settings.', unsupported: 'Reminders are not supported in this browser.',
    error: 'Could not turn on reminders. Please try again.', test: 'Send test reminder',
    iosHint: 'On iPhone: tap Share, then “Add to Home Screen”, and open the app from there.',
  },
  history: {
    title: 'Pain history', patient: 'Maria Nowak · MRN 004 2817 · Ward 4B, Bed 12 · Hip replacement',
    sample: 'Sample data', range: '{a} · {n} days',
    sAvg: 'Average pain', sOk: 'At acceptable level (≤3)', sResp: 'Staff response', sChange: 'Change after dose',
    trend: '{da} {a} → {db} {b}', ok: '{a} of {b} readings',
    resp: '{c} with no dose within 60 min', change: 'Down after {a} of {b} doses',
    spikeTitle: 'Spike to {p} · {d}, {t}', spikeText: '{drug} given {r} min later. Pain was {after} 30 min after.',
    spikeNoDose: 'No medication was given within 60 min.',
    chartTitle: 'Pain and medication', chartHint: 'Tap a dot or a dose marker for details.', legendOk: 'Acceptable (≤3)',
    tReported: 'Reported by the patient', tOk: 'Within acceptable level (≤3)',
    tNoDose: 'Above 3: no medication within 60 min', tNext: '{drug} given {r} min later',
    tPost: '{c} since {drug} at {t}', tBy: 'Given by {by}', tBefore: 'Pain before: {p} at {t}',
    tResp: 'Response time: {r} min', tScheduled: 'Scheduled dose (pain was 3 or below)',
    tAfter: 'Pain 30 min later: {p} ({c})', tConfirmed: 'Confirmed by the patient',
    chartAria: 'Pain readings from {a} to {b} with medication doses. Average pain {avg}. Highest reading {p} on {d} at {t}.',
    byDrug: 'Effect by medication', drugLine: '{n} · average change {c} after 30 min · ≤3 afterwards in {ok} of {total}',
    logTitle: 'Timeline', dayFilter: 'Show day', all: 'All',
    pain: 'Pain', afterDose: '{c} since dose', respAfter: '{r} min after pain {p}',
    scheduled: 'Scheduled', confirmed: 'patient confirmed', staff: 'RN',
    empty: 'No readings yet.',
    staffTitle: 'Staff: record a dose', staffHint: 'Prototype control. Logs a dose given now.', staffGive: 'Given now',
    staffId: 'Staff ID', resetSample: 'Reset to sample data',
  },
  labels: ['No pain', 'Mild', 'Moderate', 'Severe', 'Worst possible'],
  descs: ['no pain', 'mild pain', 'moderate pain', 'severe pain', 'worst possible pain'],
  drugs: { P: { name: 'Paracetamol', dose: '1 g', route: 'oral' }, M: { name: 'Morphine', dose: '2.5 mg', route: 'IV' } },
  doseWord: (n) => `${n} ${n === 1 ? 'dose' : 'doses'}`,
};

const pl: Strings = {
  locale: 'pl-PL',
  common: { langLabel: 'Język', viewHistory: 'Zobacz historię', back: 'Wróć do oceny bólu' },
  pick: {
    title: 'Jak bardzo Cię teraz boli?',
    sub: 'Dotknij jednej liczby. 0 to brak bólu, 10 to najgorszy możliwy ból.',
    painLevel: 'Poziom bólu',
  },
  confirm: { title: 'Czy na pewno?', youChose: 'Wybrano poziom bólu', yes: 'Tak', no: 'Nie' },
  saved: { thanks: 'Dziękujemy', recorded: 'Twój poziom bólu został zapisany.', recordedAt: 'Zapisano o', done: 'Gotowe' },
  push: {
    enable: 'Włącz przypomnienia', disable: 'Wyłącz', on: 'Przypomnienia są włączone', off: 'Przypomnienia są wyłączone',
    denied: 'Powiadomienia są zablokowane w ustawieniach przeglądarki.', unsupported: 'Ta przeglądarka nie obsługuje przypomnień.',
    error: 'Nie udało się włączyć przypomnień. Spróbuj ponownie.', test: 'Wyślij testowe przypomnienie',
    iosHint: 'Na iPhonie: dotknij Udostępnij, potem „Dodaj do ekranu początkowego” i otwórz aplikację stamtąd.',
  },
  history: {
    title: 'Historia bólu', patient: 'Maria Nowak · Nr 004 2817 · Oddział 4B, łóżko 12 · Endoproteza stawu biodrowego',
    sample: 'Dane przykładowe', range: '{a} · {n} dni',
    sAvg: 'Średni ból', sOk: 'Na poziomie akceptowalnym (≤3)', sResp: 'Reakcja personelu', sChange: 'Zmiana po leku',
    trend: '{da} {a} → {db} {b}', ok: '{a} z {b} odczytów',
    resp: '{c} bez leku w ciągu 60 min', change: 'Spadek po {a} z {b} dawek',
    spikeTitle: 'Skok do {p} · {d}, {t}', spikeText: '{drug} podana po {r} min. Po 30 min ból wynosił {after}.',
    spikeNoDose: 'Nie podano leku w ciągu 60 min.',
    chartTitle: 'Ból i leki', chartHint: 'Dotknij kropki lub znacznika leku, aby zobaczyć szczegóły.', legendOk: 'Akceptowalny (≤3)',
    tReported: 'Zgłoszone przez pacjenta', tOk: 'Na poziomie akceptowalnym (≤3)',
    tNoDose: 'Powyżej 3: brak leku w ciągu 60 min', tNext: '{drug}: podano po {r} min',
    tPost: '{c} od podania: {drug}, {t}', tBy: 'Podał(a): {by}', tBefore: 'Ból przed: {p} o {t}',
    tResp: 'Czas reakcji: {r} min', tScheduled: 'Dawka planowa (ból 3 lub mniej)',
    tAfter: 'Ból po 30 min: {p} ({c})', tConfirmed: 'Potwierdzone przez pacjenta',
    chartAria: 'Odczyty bólu od {a} do {b} z podanymi lekami. Średni ból {avg}. Najwyższy odczyt {p}: {d}, {t}.',
    byDrug: 'Skuteczność leków', drugLine: '{n} · średnia zmiana {c} po 30 min · ≤3 po podaniu: {ok} z {total}',
    logTitle: 'Oś czasu', dayFilter: 'Pokaż dzień', all: 'Wszystkie',
    pain: 'Ból', afterDose: '{c} od podania leku', respAfter: '{r} min po zgłoszeniu bólu {p}',
    scheduled: 'Planowo', confirmed: 'potwierdzone przez pacjenta', staff: 'Piel.',
    empty: 'Brak odczytów.',
    staffTitle: 'Personel: zapisz dawkę', staffHint: 'Element prototypu. Zapisuje dawkę podaną teraz.', staffGive: 'Podano teraz',
    staffId: 'Nr personelu', resetSample: 'Przywróć dane przykładowe',
  },
  labels: ['Brak bólu', 'Łagodny', 'Umiarkowany', 'Silny', 'Najgorszy możliwy'],
  descs: ['brak bólu', 'łagodny ból', 'umiarkowany ból', 'silny ból', 'najgorszy możliwy ból'],
  drugs: { P: { name: 'Paracetamol', dose: '1 g', route: 'doustnie' }, M: { name: 'Morfina', dose: '2,5 mg', route: 'dożylnie' } },
  doseWord: (n) => {
    if (n === 1) return '1 dawka';
    const a = n % 10;
    const b = n % 100;
    return `${n} ${a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'dawki' : 'dawek'}`;
  },
};

export const STRINGS: Record<Lang, Strings> = { en, pl };

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] != null ? String(vars[k]) : m));
}
