import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { LangProvider } from '../i18n/LangContext';
import { StoreProvider } from '../storage/StoreContext';
import { createStore } from '../storage/store';
import { PainCheck } from './PainCheck';

function setup() {
  const store = createStore(window.localStorage);
  render(
    <StoreProvider store={store}><LangProvider><MemoryRouter><PainCheck /></MemoryRouter></LangProvider></StoreProvider>,
  );
  return store;
}

describe('PainCheck flow', () => {
  beforeEach(() => window.localStorage.clear());

  it('records a reading only after confirmation', async () => {
    const store = setup();
    const before = store.getSnapshot().readings.length;
    await userEvent.click(screen.getByRole('button', { name: /pain level 7/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(store.getSnapshot().readings).toHaveLength(before);
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(store.getSnapshot().readings).toHaveLength(before + 1);
    expect(store.getSnapshot().readings.at(-1)?.level).toBe(7);
    expect(screen.getByText('Thank you')).toBeInTheDocument();
  });

  it('cancelling does not record', async () => {
    const store = setup();
    const before = store.getSnapshot().readings.length;
    await userEvent.click(screen.getByRole('button', { name: /pain level 3/i }));
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(store.getSnapshot().readings).toHaveLength(before);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('switches to Polish', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'PL' }));
    expect(screen.getByRole('heading', { name: 'Jak bardzo Cię teraz boli?' })).toBeInTheDocument();
  });
});
