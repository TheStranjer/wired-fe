/**
 * Tests that the refusals of the instance field follow the language (decision
 * 19): each is read when the origin is checked, not when the module loads.
 */
import { describe, expect, it } from 'vitest';

import { normalizeTypedOrigin } from './origin';
import { installFakeLocale } from '../test/i18n';

describe(normalizeTypedOrigin, () => {
  it('refuses in the language in use', () => {
    installFakeLocale({
      accounts: { need_https: 'XX https only', need_instance: 'XX enter an instance' },
    });

    expect(normalizeTypedOrigin('')).toStrictEqual({ ok: false, error: 'XX enter an instance' });
    expect(normalizeTypedOrigin('http://wired.example')).toStrictEqual({
      ok: false,
      error: 'XX https only',
    });
  });
});
