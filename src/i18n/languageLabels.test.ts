/**
 * Tests for how languages are written in pickers: the entry of a code, and
 * the `code — native name — English name` line.
 */
import { describe, expect, it } from 'vitest';

import { languageFor, languageLine } from './languageLabels';

describe(languageFor, () => {
  it('finds the entry of every code, the first and the others', () => {
    expect(languageFor('en').native).toBe('English');
    expect(languageFor('de')).toStrictEqual({ code: 'de', native: 'Deutsch', english: 'German' });
    expect(languageFor('zh-Hans').native).toBe('简体中文');
  });
});

describe(languageLine, () => {
  it('writes the code, the native name and the English name', () => {
    expect(languageLine(languageFor('ja'))).toBe('ja — 日本語 — Japanese');
  });
});
