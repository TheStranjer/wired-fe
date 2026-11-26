/**
 * Tests for the completion of `/lang` arguments (WFE-310): the first word
 * completes to the code of every language its code, native name or English
 * name starts with, and to `auto`; each is described by native name, English
 * name and code; nothing else completes.
 */
import { describe, expect, it } from 'vitest';

import { startCompletion } from './complete';
import { languageProvider } from './languageWords';
import { installFakeLocale } from '../test/i18n';

/** What Tab writes for {@link text} with the cursor at its end, or null. */
function tab(text: string): string | null {
  return startCompletion(text, text.length, [languageProvider()])?.text ?? null;
}

/** Every candidate Tab would cycle through for {@link text}. */
function candidates(text: string): readonly string[] {
  return startCompletion(text, text.length, [languageProvider()])?.state.candidates ?? [];
}

describe(languageProvider, () => {
  it('offers every language and auto, sorted, after a bare space', () => {
    expect(candidates('/lang ')).toStrictEqual(['auto', 'de', 'en', 'es', 'ja', 'ru', 'zh-Hans']);
    expect(candidates('/language ')).toStrictEqual(candidates('/lang '));
  });

  it('matches the typed letters against the code and the native name', () => {
    expect(candidates('/lang de')).toStrictEqual(['de']);
    expect(candidates('/lang Deu')).toStrictEqual(['de']);
    expect(candidates('/lang 日')).toStrictEqual(['ja']);
    expect(candidates('/lang e')).toStrictEqual(['en', 'es']);
  });

  it('matches the typed letters against the English name, and auto', () => {
    expect(candidates('/lang ger')).toStrictEqual(['de']);
    expect(candidates('/lang chi')).toStrictEqual(['zh-Hans']);
    expect(candidates('/lang au')).toStrictEqual(['auto']);
  });

  it('accepts no word when it is not told the line', () => {
    expect(languageProvider().accepts('de', false)).toBe(false);
  });

  it('completes in place with the code and a space, whatever the case', () => {
    expect(tab('/lang Deu')).toBe('/lang de ');
    expect(tab('/LANG JAP')).toBe('/LANG ja ');
  });

  it('offers nothing for a word that matches none, after the first argument or for other commands', () => {
    expect(tab('/lang xyz')).toBeNull();
    expect(tab('/lang de e')).toBeNull();
    expect(tab('/theme de')).toBeNull();
    expect(tab('/lang')).toBeNull();
  });

  it('describes a language by its native name, its English name and its code', () => {
    const { describe: row } = languageProvider();

    expect(row?.('de')).toStrictEqual({ word: 'de', label: 'Deutsch', description: 'German (de)' });
    expect(row?.('zh-Hans')).toStrictEqual({
      word: 'zh-Hans',
      label: '简体中文',
      description: 'Chinese (zh-Hans)',
    });
  });

  it('describes auto in the language in use', () => {
    const { describe: row } = languageProvider();

    expect(row?.('auto')).toStrictEqual({
      word: 'auto',
      label: 'auto',
      description: 'Follow the instance default, then the browser',
    });

    installFakeLocale({ commands: { defs: { lang: { auto_hint: 'XX auto' } } } });

    expect(row?.('auto')?.description).toBe('XX auto');
  });
});
