/**
 * Tests for the `defaultLocale` field of the build-time configuration: the
 * UI language of readers who have not chosen one.
 */
import { describe, expect, it } from 'vitest';

import { parseWiredConfig } from './schema';

/** A same-origin configuration with {@link defaultLocale} added. */
function withLocale(defaultLocale: unknown): unknown {
  return { appName: 'WiredFE', instances: { mode: 'same-origin' }, defaultLocale };
}

describe('defaultLocale', () => {
  it('may be left out', () => {
    const result = parseWiredConfig({ appName: 'WiredFE', instances: { mode: 'same-origin' } });

    expect(result.ok && result.value.defaultLocale).toBeUndefined();
  });

  it.each(['en', 'de', 'zh-Hans', 'de-AT'])('accepts %j', (code) => {
    const result = parseWiredConfig(withLocale(code));

    expect(result.ok && result.value.defaultLocale).toBe(code);
  });

  it.each(['', 'd', 'german', 'de_AT', 'de-', 'de AT', 3])('rejects %j', (code) => {
    const result = parseWiredConfig(withLocale(code));

    expect(!result.ok && result.error.some((m) => m.startsWith('defaultLocale: '))).toBe(true);
  });
});
