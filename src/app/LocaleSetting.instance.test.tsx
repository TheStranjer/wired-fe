/**
 * Tests for the build's default language feeding the choice: it wins over the
 * browser's languages, and without it the browser decides.
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocaleSetting } from './LocaleSetting';
import { activeLocale } from '../i18n/activeLocale';
import { replaceLoaders } from '../i18n/catalogs';
import { initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS } from '../state/settings';
import { AppStateProvider } from '../state/StateContext';

const config = vi.hoisted(() => ({ defaultLocale: undefined as string | undefined }));

vi.mock(import('../config/config'), () => ({
  buildConfig: {
    appName: 'WIRED',
    instances: { mode: 'same-origin' as const },
    get defaultLocale(): string | undefined {
      return config.defaultLocale;
    },
  },
}));

describe(LocaleSetting, () => {
  afterEach(() => {
    config.defaultLocale = undefined;
  });

  it('uses the build default ahead of the browser language', async () => {
    replaceLoaders({ './locales/de.json': async () => await Promise.resolve({}) });
    config.defaultLocale = 'de';
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr']);

    render(
      <AppStateProvider initial={initialAppState(DEFAULT_SETTINGS)}>
        <LocaleSetting />
      </AppStateProvider>,
    );

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });
  });

  it('falls back to the browser language without a build default', async () => {
    replaceLoaders({ './locales/de.json': async () => await Promise.resolve({}) });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-AT']);

    render(
      <AppStateProvider initial={initialAppState(DEFAULT_SETTINGS)}>
        <LocaleSetting />
      </AppStateProvider>,
    );

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });
  });
});
