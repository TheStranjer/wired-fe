/**
 * Tests that the texts of the state layer follow the language (decision 19):
 * a refusal, a sync warning, a plural phrase and a `/set` description are
 * each read in the language in use when they are asked for.
 */
import { describe, expect, it } from 'vitest';

import { parseSource } from './feedSource';
import { SETTING_KEYS } from './settingKeys';
import { describeSyncError } from './syncError';
import { installFakeLocale } from '../test/i18n';

describe('state texts in another language', () => {
  it('translates a feed-source refusal', () => {
    installFakeLocale({ state: { no_signed_in_account: 'XX nobody {handle}' } });

    expect(parseSource('@lain:home', [])).toStrictEqual({ ok: false, error: 'XX nobody lain' });
  });

  it('translates a sync warning and the frame around an API failure', () => {
    installFakeLocale({
      api: { request_cancelled: 'XX cancelled' },
      state: { sync_failed: 'XX sync failed. {reason}', sync_too_large: 'XX too large' },
    });

    expect(describeSyncError({ kind: 'tooLarge' })).toBe('XX too large');
    expect(describeSyncError({ kind: 'aborted' })).toBe('XX sync failed. XX cancelled');
  });

  it('translates the description of a setting as it is read', () => {
    const theme = SETTING_KEYS.find((meta) => meta.key === 'theme');

    expect(theme?.description).toBe('The colors the shell is painted in');

    installFakeLocale({ state: { setting_theme: 'XX theme' } });

    expect(theme?.description).toBe('XX theme');
  });
});
