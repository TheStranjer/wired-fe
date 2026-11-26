/** Tests for the list of supported languages: the six codes and their names. */
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from './supportedLocales';

describe('the supported locales', () => {
  it('lists English first, then the five translated languages, by native and English name', () => {
    expect(
      SUPPORTED_LOCALES.map((locale) => [locale.code, locale.native, locale.english]),
    ).toStrictEqual([
      ['en', 'English', 'English'],
      ['es', 'Español', 'Spanish'],
      ['ru', 'Русский', 'Russian'],
      ['ja', '日本語', 'Japanese'],
      ['zh-Hans', '简体中文', 'Chinese'],
      ['de', 'Deutsch', 'German'],
    ]);
  });
});
