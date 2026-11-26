/**
 * Tests for the startup language: the browser's language list picks the
 * supported language, and an unsupported list leaves English.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBrowserLocale } from './useBrowserLocale';
import { activeLocale } from '../i18n/activeLocale';
import { replaceLoaders } from '../i18n/catalogs';

describe(useBrowserLocale, () => {
  it('switches to the first supported language of the browser list', async () => {
    replaceLoaders({ './locales/de.json': async () => await Promise.resolve({}) });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA', 'de-AT']);

    renderHook(useBrowserLocale);

    await waitFor(() => {
      expect(activeLocale()).toBe('de');
    });
  });

  it('stays on English when the browser names none', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA']);

    renderHook(useBrowserLocale);

    expect(activeLocale()).toBe('en');
  });
});
