import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LangProvider } from './i18n/LangContext';
import { StoreProvider } from './storage/StoreContext';
import { createStore } from './storage/store';
import { registerServiceWorker } from './push/subscription';
import './index.css';

void registerServiceWorker();

const store = createStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <LangProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LangProvider>
    </StoreProvider>
  </StrictMode>,
);
