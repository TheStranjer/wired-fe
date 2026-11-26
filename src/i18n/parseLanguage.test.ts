/**
 * Tests for naming a language: by code in any case with its region dropped
 * (`de-AT`, `zh-CN`), by native name and by English name in any case, and null
 * for anything else; and for reading a stored code back.
 */
import { describe, expect, it } from 'vitest';

import { knownLanguage, parseLanguage } from './parseLanguage';

describe(parseLanguage, () => {
  it.each([
    ['de', 'de'],
    ['DE', 'de'],
    ['de-AT', 'de'],
    ['en-GB', 'en'],
    ['zh', 'zh-Hans'],
    ['zh-CN', 'zh-Hans'],
    ['zh-Hans', 'zh-Hans'],
    ['ZH-hans', 'zh-Hans'],
    ['zh-TW', 'zh-Hans'],
    ['ja', 'ja'],
  ])('reads the code %s as %s', (input, expected) => {
    expect(parseLanguage(input)).toBe(expected);
  });

  it.each([
    ['Deutsch', 'de'],
    ['deutsch', 'de'],
    ['日本語', 'ja'],
    ['Español', 'es'],
    ['ESPAÑOL', 'es'],
    ['Русский', 'ru'],
    ['简体中文', 'zh-Hans'],
    ['English', 'en'],
  ])('reads the native name %s as %s', (input, expected) => {
    expect(parseLanguage(input)).toBe(expected);
  });

  it.each([
    ['German', 'de'],
    ['german', 'de'],
    ['Chinese', 'zh-Hans'],
    ['Japanese', 'ja'],
    ['Spanish', 'es'],
    ['Russian', 'ru'],
    ['  German  ', 'de'],
  ])('reads the English name %s as %s', (input, expected) => {
    expect(parseLanguage(input)).toBe(expected);
  });

  it.each(['', 'fr', 'Klingon', 'de x', 'germany', 'auto', '--pick'])('refuses %j', (input) => {
    expect(parseLanguage(input)).toBeNull();
  });
});

describe(knownLanguage, () => {
  it('keeps the code of a supported language', () => {
    expect(knownLanguage('zh-Hans')).toBe('zh-Hans');
  });

  it('drops a code this build does not know, and null', () => {
    expect(knownLanguage('tlh')).toBeNull();
    expect(knownLanguage(null)).toBeNull();
  });
});
