/**
 * Tests for the browser-language reader: the language subtag, lowercased,
 * with `en` for a tag that has none.
 */
import { describe, expect, it } from 'vitest';

import { localeOf } from './locale';

describe(localeOf, () => {
  it.each([
    ['en-US', 'en'],
    ['de', 'de'],
    ['PT-br', 'pt'],
    ['', 'en'],
    ['-US', 'en'],
  ])('reads %j as %s', (language, locale) => {
    expect(localeOf(language)).toBe(locale);
  });
});
