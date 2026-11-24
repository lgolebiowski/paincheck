import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LangToggle } from '../components/LangToggle';
import { PushToggle } from '../components/PushToggle';
import { PAIN_LEVELS, painCategory, painColors } from '../domain/painScale';
import type { PainLevel } from '../domain/types';
import { useLang } from '../i18n/LangContext';
import { reportReading } from '../push/api';
import { useStore } from '../storage/StoreContext';

type Step = { kind: 'pick' } | { kind: 'confirm'; level: PainLevel } | { kind: 'saved'; level: PainLevel; at: number };

const HistoryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
  </svg>
);

export function PainCheck() {
  const { t } = useLang();
  const store = useStore();
  const [step, setStep] = useState<Step>({ kind: 'pick' });

  const info = (level: PainLevel) => {
    const cat = painCategory(level);
    return { ...painColors(level), n: level, label: t.labels[cat], desc: t.descs[cat] };
  };

  const save = (level: PainLevel) => {
    const at = Date.now();
    store.addReading(level, at);
    void reportReading();
    setStep({ kind: 'saved', level, at });
  };

  if (step.kind === 'saved') {
    const s = info(step.level);
    const time = new Date(step.at).toLocaleTimeString(t.locale, { hour: 'numeric', minute: '2-digit' });
    return (
      <div style={{ flex: 1, padding: '28px 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
          <div aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 9999, background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: '36px', fontWeight: 700, letterSpacing: '-0.02em' }}>{t.saved.thanks}</h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: '26px', color: '#525252' }}>{t.saved.recorded}</p>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', border: '1px solid #e5e5e5', borderRadius: 12 }}>
            <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 9999, background: s.bg, color: s.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>{s.n}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{t.pick.painLevel} {s.n} · {s.label}</span>
              <span style={{ fontSize: 15, color: '#525252' }}>{t.saved.recordedAt} {time}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => setStep({ kind: 'pick' })}>{t.saved.done}</button>
          <Link to="/history" className="btn btn-secondary" style={{ height: 64, fontSize: 20 }}>{t.common.viewHistory}</Link>
        </div>
      </div>
    );
  }

  const confirming = step.kind === 'confirm' ? info(step.level) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <LangToggle />
          <Link to="/history" style={{ height: 44, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', border: '1px solid #d4d4d4', borderRadius: 10, background: '#fff', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            <HistoryIcon />{t.common.viewHistory}
          </Link>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 700, letterSpacing: '-0.02em' }}>{t.pick.title}</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: '22px', color: '#525252' }}>{t.pick.sub}</p>
        <PushToggle compact />
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(6, minmax(72px, 1fr))', gap: 10 }}>
        {PAIN_LEVELS.map((n) => {
          const l = info(n);
          return (
            <button key={n} type="button" onClick={() => setStep({ kind: 'confirm', level: n })} aria-label={`${t.pick.painLevel} ${n}, ${l.label.toLowerCase()}`}
              style={{ gridColumn: n === 0 ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 0, borderRadius: 12, background: l.bg, color: l.fg, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
              <span style={{ fontSize: 44, lineHeight: '46px', fontWeight: 700 }}>{n}</span>
              <span style={{ fontSize: 15, lineHeight: '18px', fontWeight: 600 }}>{l.label}</span>
            </button>
          );
        })}
      </div>

      {confirming && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
            style={{ width: '100%', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <div aria-hidden="true" style={{ width: 120, height: 120, borderRadius: 9999, background: confirming.bg, color: confirming.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 60, lineHeight: '60px', fontWeight: 700 }}>{confirming.n}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{confirming.label}</span>
              </div>
              <h2 id="confirm-title" style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 700, letterSpacing: '-0.02em' }}>{t.confirm.title}</h2>
              <p id="confirm-desc" style={{ margin: 0, fontSize: 18, lineHeight: '26px', color: '#525252' }}>
                {t.confirm.youChose} <strong style={{ color: '#0a0a0a' }}>{confirming.n}</strong> ({confirming.desc}).
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" autoFocus className="btn btn-primary" onClick={() => save(confirming.n)}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {t.confirm.yes}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep({ kind: 'pick' })}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                {t.confirm.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
