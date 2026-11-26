/**
 * Tests for the language in use following the choice (WFE-310): the setting
 * beats the browser's language list, an unset setting leaves the browser to
 * decide, and a change of the setting at run time (`/lang`, a sync) switches
 * the language and `<html lang>` at once.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleSetting } from './LocaleSetting';
import { activeLocale } from '../i18n/activeLocale';
import { I18nProvider } from '../i18n/I18nProvider';
import { initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS } from '../state/settings';
import { AppStateProvider, useAppDispatch } from '../state/StateContext';

/** Buttons that choose a language the way `/lang` does. */
function Chooser(): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <>
      <button
        onClick={() => {
          dispatch({ type: 'settings', settings: { language: 'ja' } });
        }}
        type="button"
      >
        japanese
      </button>
      <button
        onClick={() => {
          dispatch({ type: 'settings', settings: { language: null } });
        }}
        type="button"
      >
        auto
      </button>
    </>
  );
}

/** Draws the setting's effect over a session whose language setting is {@link language}. */
function show(language: 'de' | null = null): void {
  render(
    <I18nProvider>
      <AppStateProvider initial={initialAppState({ ...DEFAULT_SETTINGS, language })}>
        <LocaleSetting />
        <Chooser />
      </AppStateProvider>
    </I18nProvider>,
  );
}

describe(LocaleSetting, () => {
  it('shows the language of the setting, over the browser, and puts it on <html lang>', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru']);

    show('de');

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });

    expect(document.documentElement.lang).toBe('de');
  });

  it('leaves the browser to decide while the setting is unset', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA', 'ru-RU']);

    show();

    await waitFor(() => {
      expect(activeLocale()).toBe('ru');
    });
  });

  it('stays on English when neither names a supported language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA']);

    show();

    expect(activeLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches when the setting changes, and back to the browser when it is cleared', async () => {
    show();

    fireEvent.click(screen.getByRole('button', { name: 'japanese' }));

    await waitFor(() => {
      expect(activeLocale()).toBe('ja');
    });

    expect(document.documentElement.lang).toBe('ja');

    fireEvent.click(screen.getByRole('button', { name: 'auto' }));

    await waitFor(() => {
      expect(activeLocale()).toBe('en');
    });

    expect(document.documentElement.lang).toBe('en');
  });
});
