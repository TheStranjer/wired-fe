/**
 * Tests for the build's default language feeding the startup choice: it wins
 * over the browser's languages, and without it the browser decides.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBrowserLocale } from './useBrowserLocale';
import { activeLocale } from '../i18n/activeLocale';
import { replaceLoaders } from '../i18n/catalogs';

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

describe(useBrowserLocale, () => {
  afterEach(() => {
    config.defaultLocale = undefined;
  });

  it('uses the build default ahead of the browser language', async () => {
    replaceLoaders({ './locales/de.json': async () => await Promise.resolve({}) });
    config.defaultLocale = 'de';
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr']);

    renderHook(useBrowserLocale);

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });
  });

  it('falls back to the browser language without a build default', async () => {
    replaceLoaders({ './locales/de.json': async () => await Promise.resolve({}) });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-AT']);

    renderHook(useBrowserLocale);

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });
  });
});
