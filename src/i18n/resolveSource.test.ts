/**
 * Tests for which source decided the language: the reader's setting, the
 * instance default, the browser, or none of them (the fallback).
 */
import { describe, expect, it } from 'vitest';

import { resolveSource } from './resolveLocale';

describe(resolveSource, () => {
  it('names the first source that names a supported language', () => {
    const browser = ['ja'];

    expect(resolveSource({ user: 'es', instance: 'ru', browser })).toStrictEqual({
      locale: 'es',
      source: 'user',
    });
    expect(resolveSource({ instance: 'ru', browser })).toStrictEqual({
      locale: 'ru',
      source: 'instance',
    });
    expect(resolveSource({ browser })).toStrictEqual({ locale: 'ja', source: 'browser' });
  });

  it('skips a source that names none and falls back to English', () => {
    expect(resolveSource({ user: 'fr', browser: ['sv', 'de-AT'] })).toStrictEqual({
      locale: 'de',
      source: 'browser',
    });
    expect(resolveSource({ user: 'fr', browser: ['sv'] })).toStrictEqual({
      locale: 'en',
      source: 'fallback',
    });
    expect(resolveSource({})).toStrictEqual({ locale: 'en', source: 'fallback' });
  });
});
