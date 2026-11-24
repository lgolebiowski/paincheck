import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { PatientData } from '../domain/types';
import type { Store } from './store';

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

export function usePatientData(): PatientData {
  const s = useStore();
  return useSyncExternalStore(s.subscribe, s.getSnapshot);
}
