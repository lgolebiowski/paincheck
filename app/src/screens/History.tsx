import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LangToggle } from '../components/LangToggle';
import { PushToggle } from '../components/PushToggle';
import { ACCEPTABLE_MAX, DRUG_COLORS, painCategory, painColors } from '../domain/painScale';
import { computeHistory, type DoseView, type HistoryModel } from '../domain/history';
import type { DrugCode } from '../domain/types';
import { useLang } from '../i18n/LangContext';
import { fill, type Strings } from '../i18n/strings';
import { reportDose } from '../push/api';
import { usePatientData, useStore } from '../storage/StoreContext';

const X0 = 28;
const PLOT_W = 324;
const DAY_START_MIN = 6 * 60;
const DAY_SPAN_MIN = 16 * 60;
const yOf = (p: number) => 190 - p * 17;

interface Tip {
  x: number; y: number; when: string; badge: string | number; bg: string; fg: string; radius: string; title: string;
  lines: { text: string; color: string; weight: number }[]; kind: 'point' | 'dose';
}

export function History() {
  const { t, lang } = useLang();
  const store = useStore();
  const data = usePatientData();
  const model = useMemo(() => computeHistory(data), [data]);
  const [dayFilter, setDayFilter] = useState<'all' | number>('all');
  const [hover, setHover] = useState<string | null>(null);
  const h = t.history;

  const num = (x: number, d: number) => (lang === 'pl' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
  const signed = (x: number, d: number) => (x < 0 ? '−' : x > 0 ? '+' : '') + num(Math.abs(x), d);
  const chTxt = (c: number) => (c === 0 ? '0' : signed(c, 0));
  const chCol = (c: number) => (c < 0 ? '#15803d' : c > 0 ? '#b91c1c' : '#404040');
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLong = (ms: number) => new Date(ms).toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const dayTab = (ms: number) => new Date(ms).toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric' });
  const dayShort = (ms: number) => new Date(ms).toLocaleDateString(t.locale, { weekday: 'short' });
  const drugTitle = (c: DrugCode) => `${t.drugs[c].name} ${t.drugs[c].dose} · ${t.drugs[c].route}`;

  if (model.days.length === 0) {
    return (
      <Shell t={t}><p style={{ padding: 16 }}>{h.empty}</p></Shell>
    );
  }

  const nDays = model.days.length;
  const DW = PLOT_W / nDays;
  const xOf = (dayIdx: number, ms: number, dayStart: number) => {
    const m = Math.max(DAY_START_MIN, Math.min(DAY_START_MIN + DAY_SPAN_MIN, (ms - dayStart) / 60_000));
    return Math.round((X0 + dayIdx * DW + ((m - DAY_START_MIN) / DAY_SPAN_MIN) * DW) * 10) / 10;
  };

  // Chart geometry + tooltip content.
  const tips = new Map<string, Tip>();
  const points: { key: string; x: number; y: number; bg: string; aria: string }[] = [];
  const dayLines: string[] = [];
  const doseMarks: { key: string; x: number; color: string; aria: string }[] = [];

  model.days.forEach((day, d) => {
    const pts: string[] = [];
    day.readings.forEach((rv, i) => {
      const r = rv.reading;
      const col = painColors(r.level);
      const x = xOf(d, r.at, day.start);
      const y = yOf(r.level);
      const lines: Tip['lines'] = [];
      if (rv.postDose && rv.postDose.change != null)
        lines.push({ text: fill(h.tPost, { c: chTxt(rv.postDose.change), drug: t.drugs[rv.postDose.dose.drug].name, t: hhmm(rv.postDose.dose.at) }), color: chCol(rv.postDose.change), weight: 600 });
      if (r.level > ACCEPTABLE_MAX && rv.nextDose)
        lines.push({ text: fill(h.tNext, { drug: t.drugs[rv.nextDose.dose.drug].name, r: Math.round((rv.nextDose.dose.at - r.at) / 60_000) }), color: '#404040', weight: 400 });
      if (r.level > ACCEPTABLE_MAX && !rv.nextDose) lines.push({ text: h.tNoDose, color: '#b91c1c', weight: 600 });
      if (r.level <= ACCEPTABLE_MAX) lines.push({ text: h.tOk, color: '#15803d', weight: 400 });
      lines.push({ text: h.tReported, color: '#525252', weight: 400 });
      const key = `p-${d}-${i}`;
      tips.set(key, { kind: 'point', x, y, when: `${dayLong(day.start)} · ${hhmm(r.at)}`, badge: r.level, bg: col.bg, fg: col.fg, radius: '9999px', title: `${h.pain} ${r.level} · ${t.labels[painCategory(r.level)]}`, lines });
      points.push({ key, x, y, bg: col.bg, aria: `${h.pain} ${r.level}, ${dayLong(day.start)} ${hhmm(r.at)}` });
      pts.push(`${x},${y}`);
    });
    dayLines.push(pts.join(' '));

    day.doses.forEach((dv, i) => {
      const x = xOf(d, dv.dose.at, day.start);
      const lines: Tip['lines'] = [{ text: fill(h.tBy, { by: `${h.staff} ${dv.dose.by}` }), color: '#404040', weight: 400 }];
      if (dv.before) lines.push({ text: fill(h.tBefore, { p: dv.before.level, t: hhmm(dv.before.at) }), color: '#404040', weight: 400 });
      lines.push(dv.responseMin != null ? { text: fill(h.tResp, { r: dv.responseMin }), color: '#0a0a0a', weight: 600 } : { text: h.tScheduled, color: '#525252', weight: 400 });
      if (dv.after) lines.push({ text: fill(h.tAfter, { p: dv.after.level, c: dv.change == null ? '—' : chTxt(dv.change) }), color: dv.change == null ? '#404040' : chCol(dv.change), weight: 600 });
      lines.push({ text: h.tConfirmed, color: '#15803d', weight: 400 });
      const key = `d-${d}-${i}`;
      tips.set(key, { kind: 'dose', x, y: 198, when: `${dayLong(day.start)} · ${hhmm(dv.dose.at)}`, badge: dv.dose.drug, bg: DRUG_COLORS[dv.dose.drug], fg: '#fff', radius: '8px', title: drugTitle(dv.dose.drug), lines });
      doseMarks.push({ key, x, color: DRUG_COLORS[dv.dose.drug], aria: `${t.drugs[dv.dose.drug].name}, ${dayLong(day.start)} ${hhmm(dv.dose.at)}` });
    });
  });

  const tip = hover ? tips.get(hover) ?? null : null;
  const first = model.days[0]!;
  const last = model.days[nDays - 1]!;
  const spike = model.spike;

  return (
    <Shell t={t}>
      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#525252' }}>{h.patient}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip border>{fill(h.range, { a: `${dayLong(first.start)} – ${dayLong(last.start)}`, n: nDays })}</Chip>
            {data.readings.some((r) => r.id.startsWith('seed-')) && <Chip>{h.sample}</Chip>}
          </div>
        </div>

        <Stats model={model} t={t} num={num} signed={signed} firstShort={dayShort(first.start)} lastShort={dayShort(last.start)} />

        {spike && (
          <div style={{ background: '#0a0a0a', color: '#fafafa', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 36, height: 36, borderRadius: 9999, background: painColors(spike.reading.level).bg, color: painColors(spike.reading.level).fg, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spike.reading.level}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{fill(h.spikeTitle, { p: spike.reading.level, d: dayLong(model.days[spike.dayIndex]!.start), t: hhmm(spike.reading.at) })}</span>
              <span style={{ fontSize: 13, lineHeight: '18px', color: '#d4d4d4' }}>{spikeText(spike.followUp, spike.reading.at, t)}</span>
            </div>
          </div>
        )}

        <section aria-labelledby="m-chart-title" style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 id="m-chart-title" style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{h.chartTitle}</h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: '#525252' }}>{h.chartHint}</p>
          </div>
          <div onMouseLeave={() => setHover(null)} style={{ position: 'relative' }}>
            <svg viewBox="0 0 360 232" role="img" aria-label={spike ? fill(h.chartAria, { a: dayLong(first.start), b: dayLong(last.start), avg: num(model.avg, 1), p: spike.reading.level, d: dayLong(model.days[spike.dayIndex]!.start), t: hhmm(spike.reading.at) }) : ''} style={{ display: 'block', width: '100%', height: 'auto' }}>
              <rect x={X0} y={yOf(ACCEPTABLE_MAX)} width={PLOT_W} height={yOf(0) - yOf(ACCEPTABLE_MAX)} fill="#dcfce7" />
              {[0, 2, 4, 6, 8, 10].map((v) => (
                <g key={v}>
                  <line x1={X0} x2={X0 + PLOT_W} y1={yOf(v)} y2={yOf(v)} stroke="#e5e5e5" />
                  <text x={20} y={yOf(v) + 3.5} textAnchor="end" fontSize={10} fill="#525252">{v}</text>
                </g>
              ))}
              {model.days.map((day, d) => (
                <g key={day.start}>
                  <line x1={X0 + d * DW} x2={X0 + d * DW} y1={16} y2={206} stroke="#d4d4d4" />
                  <text x={X0 + d * DW + DW / 2} y={224} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0a0a0a">{dayShort(day.start)}</text>
                </g>
              ))}
              {doseMarks.map((m) => (
                <g key={m.key}>
                  <line x1={m.x} x2={m.x} y1={20} y2={190} stroke={m.color} strokeDasharray="3 3" opacity={0.5} />
                  <rect x={m.x - 3.5} y={195} width={7} height={7} rx={1.5} fill={m.color} />
                </g>
              ))}
              {dayLines.map((p, i) => <polyline key={i} points={p} fill="none" stroke="#404040" strokeWidth={1.5} strokeLinejoin="round" />)}
              {points.map((p) => <circle key={p.key} cx={p.x} cy={p.y} r={4.5} fill={p.bg} stroke="#fff" strokeWidth={1.5} />)}
              {tip?.kind === 'point' && <circle cx={tip.x} cy={tip.y} r={8} fill="none" stroke="#0a0a0a" strokeWidth={2} />}
              {tip?.kind === 'dose' && <line x1={tip.x} x2={tip.x} y1={20} y2={190} stroke="#0a0a0a" strokeWidth={2} />}
              {doseMarks.map((m) => (
                <rect key={m.key} x={m.x - 7} y={188} width={14} height={22} fill="transparent" tabIndex={0} role="button" aria-label={m.aria}
                  onMouseEnter={() => setHover(m.key)} onFocus={() => setHover(m.key)} onBlur={() => setHover(null)} onClick={() => setHover(m.key)} style={{ cursor: 'pointer', outline: 'none' }} />
              ))}
              {points.map((p) => (
                <circle key={p.key} cx={p.x} cy={p.y} r={9} fill="transparent" tabIndex={0} role="button" aria-label={p.aria}
                  onMouseEnter={() => setHover(p.key)} onFocus={() => setHover(p.key)} onBlur={() => setHover(null)} onClick={() => setHover(p.key)} style={{ cursor: 'pointer', outline: 'none' }} />
              ))}
            </svg>
            {tip && <Tooltip tip={tip} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12, color: '#404040' }}>
            <Legend swatch={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 3, width: 12, height: 12 }}>{h.legendOk}</Legend>
            {(['P', 'M'] as const).map((c) => (
              <Legend key={c} swatch={{ background: DRUG_COLORS[c], borderRadius: 2, width: 10, height: 10 }}>{t.drugs[c].name} {t.drugs[c].dose}</Legend>
            ))}
          </div>
        </section>

        <section aria-label={h.byDrug} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {model.perDrug.map((s) => (
            <div key={s.drug} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 34, height: 34, borderRadius: 8, background: DRUG_COLORS[s.drug], color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.drug}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{drugTitle(s.drug)}</span>
                <span style={{ fontSize: 13, lineHeight: '18px', color: '#525252' }}>{fill(h.drugLine, { n: t.doseWord(s.doses), c: signed(s.avgChange, 1), ok: s.okAfter, total: s.doses })}</span>
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="m-log-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 id="m-log-title" style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{h.logTitle}</h2>
          <div role="group" aria-label={h.dayFilter} className="tabs-scroll">
            {([{ key: 'all' as const, label: h.all }, ...model.days.map((d, i) => ({ key: i, label: dayTab(d.start) }))]).map((tb) => {
              const on = tb.key === dayFilter;
              return (
                <button key={tb.key} type="button" aria-pressed={on} onClick={() => setDayFilter(tb.key)}
                  style={{ flex: 'none', height: 40, padding: '0 14px', borderRadius: 9999, border: `1px solid ${on ? '#171717' : '#e5e5e5'}`, background: on ? '#171717' : '#fff', color: on ? '#fafafa' : '#0a0a0a', fontSize: 14, fontWeight: 600 }}>{tb.label}</button>
              );
            })}
          </div>
          {model.days.map((day, d) => (dayFilter === 'all' || dayFilter === d) && (
            <div key={day.start} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e5e5e5', fontSize: 14, fontWeight: 600 }}>{dayLong(day.start)}</div>
              {timeline(day.readings, day.doses).map((e) => (
                <div key={e.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderBottom: '1px solid #f0f0f0', background: e.rowBg }}>
                  <span style={{ flex: 'none', width: 40, paddingTop: 6, fontSize: 13, color: '#525252' }}>{hhmm(e.at)}</span>
                  <span aria-hidden="true" style={{ flex: 'none', width: 32, height: 32, borderRadius: e.radius, background: e.bg, color: e.fg, fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{e.badge}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingTop: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{e.title}</span>
                    <span style={{ fontSize: 13, lineHeight: '18px', color: '#525252' }}>{e.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        <section aria-label="Reminders" style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14 }}><PushToggle /></section>

        <StaffPanel t={t} onDose={(drug, by) => {
          const at = Date.now();
          store.addDose(drug, by, at);
          void reportDose(drug, at);
        }} onReset={() => store.resetToSample()} />
      </div>
    </Shell>
  );

  function timeline(readings: HistoryModel['days'][number]['readings'], doses: DoseView[]) {
    const ev = [
      ...doses.map((dv) => ({
        key: dv.dose.id, at: dv.dose.at, order: 0, badge: dv.dose.drug as string | number, bg: DRUG_COLORS[dv.dose.drug], fg: '#fff', radius: '8px',
        rowBg: dv.dose.drug === 'M' ? '#faf5ff' : '#fff', title: drugTitle(dv.dose.drug),
        sub: `${h.staff} ${dv.dose.by} · ${dv.responseMin != null && dv.before ? fill(h.respAfter, { r: dv.responseMin, p: dv.before.level }) : h.scheduled} · ${h.confirmed}`,
      })),
      ...readings.map((rv) => {
        const c = painColors(rv.reading.level);
        const ch = rv.postDose?.change;
        return {
          key: rv.reading.id, at: rv.reading.at, order: 1, badge: rv.reading.level as string | number, bg: c.bg, fg: c.fg, radius: '9999px', rowBg: '#fff',
          title: `${h.pain} ${rv.reading.level} · ${t.labels[painCategory(rv.reading.level)]}`,
          sub: ch != null ? fill(h.afterDose, { c: chTxt(ch) }) : '',
        };
      }),
    ];
    return ev.sort((a, b) => a.at - b.at || a.order - b.order);
  }
}

function spikeText(f: DoseView | null, readingAt: number, t: Strings): string {
  if (!f) return t.history.spikeNoDose;
  return fill(t.history.spikeText, {
    drug: t.drugs[f.dose.drug].name,
    r: Math.round((f.dose.at - readingAt) / 60_000),
    after: f.after ? f.after.level : '—',
  });
}

function Shell({ t, children }: { t: Strings; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fafafa' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '12px 12px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <Link to="/" aria-label={t.common.back} style={{ width: 44, height: 44, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          <h1 style={{ margin: 0, fontSize: 20, lineHeight: '26px', fontWeight: 700, letterSpacing: '-0.01em' }}>{t.history.title}</h1>
        </div>
        <LangToggle size="sm" />
      </header>
      {children}
    </div>
  );
}

function Stats({ model, t, num, signed, firstShort, lastShort }: { model: HistoryModel; t: Strings; num: (x: number, d: number) => string; signed: (x: number, d: number) => string; firstShort: string; lastShort: string }) {
  const h = t.history;
  const first = model.days[0]!;
  const last = model.days[model.days.length - 1]!;
  const stats = [
    { label: h.sAvg, value: num(model.avg, 1), sub: fill(h.trend, { da: firstShort, a: num(first.avg, 1), db: lastShort, b: num(last.avg, 1) }) },
    { label: h.sOk, value: `${Math.round((model.okCount / model.readingCount) * 100)}%`, sub: fill(h.ok, { a: model.okCount, b: model.readingCount }) },
    { label: h.sResp, value: model.avgResponseMin != null ? `${model.avgResponseMin} min` : '—', sub: fill(h.resp, { c: model.unanswered }) },
    { label: h.sChange, value: signed(model.avgChange, 1), sub: fill(h.change, { a: model.downCount, b: model.changeCount }) },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, lineHeight: '17px', fontWeight: 500, color: '#525252' }}>{s.label}</span>
          <span style={{ fontSize: 28, lineHeight: '32px', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</span>
          <span style={{ fontSize: 12, lineHeight: '16px', color: '#525252' }}>{s.sub}</span>
        </div>
      ))}
    </div>
  );
}

function Tooltip({ tip }: { tip: Tip }) {
  const lp = (tip.x / 360) * 100;
  const tp = (tip.y / 232) * 100;
  const above = tip.y > 232 * 0.45;
  const tx = lp < 30 ? '-8%' : lp > 70 ? '-92%' : '-50%';
  return (
    <div role="tooltip" style={{ position: 'absolute', left: `${lp}%`, top: `${tp}%`, transform: `translate(${tx}, ${above ? 'calc(-100% - 16px)' : '16px'})`, width: 230, zIndex: 3, pointerEvents: 'none', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, lineHeight: '17px' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#525252' }}>{tip.when}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ flex: 'none', width: 32, height: 32, borderRadius: tip.radius, background: tip.bg, color: tip.fg, fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{tip.badge}</span>
        <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600 }}>{tip.title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tip.lines.map((l, i) => <span key={i} style={{ color: l.color, fontWeight: l.weight }}>{l.text}</span>)}
      </div>
    </div>
  );
}

function Chip({ children, border }: { children: React.ReactNode; border?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 10px', border: border ? '1px solid #e5e5e5' : 0, background: border ? '#fff' : '#f0f0f0', borderRadius: 9999, fontSize: 13, fontWeight: 500, color: border ? undefined : '#404040' }}>{children}</span>
  );
}

function Legend({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden="true" style={swatch} />{children}
    </span>
  );
}

function StaffPanel({ t, onDose, onReset }: { t: Strings; onDose: (d: DrugCode, by: string) => void; onReset: () => void }) {
  const [drug, setDrug] = useState<DrugCode>('P');
  const [by, setBy] = useState('214');
  const h = t.history;
  return (
    <section aria-labelledby="staff-title" style={{ background: '#fff', border: '1px dashed #a3a3a3', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h2 id="staff-title" style={{ margin: 0, fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{h.staffTitle}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#525252' }}>{h.staffHint}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Drug" value={drug} onChange={(e) => setDrug(e.target.value as DrugCode)} style={{ height: 44, borderRadius: 10, border: '1px solid #d4d4d4', padding: '0 8px', fontSize: 15, flex: '1 1 160px' }}>
          {(['P', 'M'] as const).map((c) => <option key={c} value={c}>{t.drugs[c].name} {t.drugs[c].dose}</option>)}
        </select>
        <input aria-label={h.staffId} value={by} onChange={(e) => setBy(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={{ height: 44, width: 90, borderRadius: 10, border: '1px solid #d4d4d4', padding: '0 10px', fontSize: 15 }} />
        <button type="button" disabled={!by} onClick={() => onDose(drug, by)} style={{ height: 44, padding: '0 16px', borderRadius: 10, border: 0, background: '#171717', color: '#fafafa', fontSize: 15, fontWeight: 600 }}>{h.staffGive}</button>
      </div>
      <button type="button" onClick={onReset} style={{ alignSelf: 'flex-start', height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #d4d4d4', background: '#fff', fontSize: 14, fontWeight: 600 }}>{h.resetSample}</button>
    </section>
  );
}
