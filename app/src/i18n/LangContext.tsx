import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../domain/types';
import { syncPushLanguage } from '../push/subscription';
import { STRINGS, type Strings } from './strings';

const KEY = 'painApp.lang';

function readLang(): Lang {
  try {
    const s = window.localStorage.getItem(KEY);
    if (s === 'en' || s === 'pl') return s;
  } catch {
    // ignore
  }
  return 'en';
}

interface LangCtx { lang: Lang; t: Strings; setLang: (l: Lang) => void }
const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'en' || e.newValue === 'pl')) setLangState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try { window.localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setLangState(l);
    void syncPushLanguage(l);
  }, []);

  const value = useMemo(() => ({ lang, t: STRINGS[lang], setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang must be used inside LangProvider');
  return c;
}
