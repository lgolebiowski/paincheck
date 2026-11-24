import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { sendTestPush } from '../push/api';
import { disablePush, enablePush, getPushState, type PushState } from '../push/subscription';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const btn = { height: 44, padding: '0 14px', borderRadius: 10, border: '1px solid #d4d4d4', background: '#fff', color: '#0a0a0a', fontSize: 15, fontWeight: 600 } as const;

/**
 * Reminder (web push) controls.
 * `compact` is a prompt for the main screen: shown only when reminders can be turned on, otherwise renders nothing.
 */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s), () => alive && setState('unsupported'));
    return () => { alive = false; };
  }, []);

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setError(false);
    try { setState(await fn()); } catch { setError(true); } finally { setBusy(false); }
  };

  if (state === 'loading') return null;
  if (compact && state !== 'off') return null;

  const p = t.push;
  // iOS only exposes push to apps installed to the Home Screen.
  const needsInstall = state === 'unsupported' && isIos() && !isStandalone();
  const message = state === 'on' ? p.on : state === 'denied' ? p.denied : state === 'unsupported' ? (needsInstall ? p.iosHint : p.unsupported) : p.off;

  return (
    <div role="group" aria-label={p.on} style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'stretch', justifyContent: 'space-between', gap: 8, fontSize: 14, color: '#404040' }}>
      <span role="status">{message}</span>
      {error && <span role="alert" style={{ color: '#b91c1c' }}>{p.error}</span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {state === 'off' && <button type="button" disabled={busy} style={btn} onClick={() => run(() => enablePush(lang))}>{p.enable}</button>}
        {state === 'on' && !compact && (
          <>
            <button type="button" disabled={busy} style={btn} onClick={() => void sendTestPush()}>{p.test}</button>
            <button type="button" disabled={busy} style={btn} onClick={() => run(disablePush)}>{p.disable}</button>
          </>
        )}
      </div>
    </div>
  );
}
