/**
 * Tests for the choice of language: the reader's setting, then the instance
 * default, then each browser language, then English; a tag matches by its
 * language subtag and every Chinese tag is Simplified.
 */
import { describe, expect, it } from 'vitest';

import { resolveLocale } from './resolveLocale';

describe(resolveLocale, () => {
  it('prefers the reader, then the instance, then the browser', () => {
    const browser = ['ja'];

    expect(resolveLocale({ user: 'es', instance: 'ru', browser })).toBe('es');
    expect(resolveLocale({ instance: 'ru', browser })).toBe('ru');
    expect(resolveLocale({ browser })).toBe('ja');
  });

  it('skips a source that names no supported language', () => {
    expect(resolveLocale({ user: 'fr', instance: 'sv', browser: ['pt-BR', 'de-AT'] })).toBe('de');
  });

  it('takes the first supported language of the browser list', () => {
    expect(resolveLocale({ browser: ['fr-CA', 'ru-RU', 'es'] })).toBe('ru');
  });

  it('matches by language subtag, whatever the case', () => {
    expect(resolveLocale({ user: 'de-AT' })).toBe('de');
    expect(resolveLocale({ user: 'ES-mx' })).toBe('es');
    expect(resolveLocale({ user: 'en-GB' })).toBe('en');
  });

  it.each(['zh', 'zh-TW', 'zh-Hant', 'zh-Hans-CN', 'zh-HK'])(
    'reads %s as Simplified Chinese',
    (tag) => {
      expect(resolveLocale({ browser: [tag] })).toBe('zh-Hans');
    },
  );

  it('falls back to English when nothing names a supported language', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ user: '', browser: ['fr', 'sv-SE'] })).toBe('en');
    expect(resolveLocale({ browser: [] })).toBe('en');
  });
});
