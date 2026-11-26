/**
 * Tests for the language setting (WFE-310): a chosen language reads back, an
 * old stored record without it (or with a code this build does not know)
 * reads as unset.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from './settings';

/** Parse {@link input} with SettingsSchema. */
function parse(input: unknown): Settings {
  return v.parse(SettingsSchema, input);
}

describe('the language setting', () => {
  it('is unset by default', () => {
    expect(DEFAULT_SETTINGS.language).toBeNull();
  });

  it('reads the chosen language back, and an old record without it as unset', () => {
    const old = { theme: 'lain', keyOverrides: [] };

    expect(parse({ language: 'zh-Hans' }).language).toBe('zh-Hans');
    expect(parse(old).language).toBeNull();
    expect(parse({ language: null }).language).toBeNull();
  });

  it('reads a language this build does not know as unset', () => {
    expect(parse({ language: 'tlh' }).language).toBeNull();
  });
});
