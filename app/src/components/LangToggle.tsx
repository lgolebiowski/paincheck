import { useLang } from '../i18n/LangContext';
import type { Lang } from '../domain/types';

export function LangToggle({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const { lang, setLang, t } = useLang();
  const w = size === 'lg' ? 48 : 44;
  const fs = size === 'lg' ? 15 : 14;
  return (
    <div role="group" aria-label={t.common.langLabel} style={{ flex: 'none', display: 'inline-flex', gap: 2, padding: 3, background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 10 }}>
      {(['en', 'pl'] as Lang[]).map((l) => {
        const on = lang === l;
        return (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={on}
            style={{ width: w, height: 38, border: 0, borderRadius: 7, background: on ? '#fff' : 'transparent', color: on ? '#0a0a0a' : '#525252', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none', fontSize: fs, fontWeight: 600 }}>
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
