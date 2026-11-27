/**
 * Tests for the lazy loading of catalogs: one load per language however many
 * switches ask for it, a language with no file yet becoming active with
 * English messages, a failed load leaving English active (and being tried
 * again), an overlapping switch
 * where the later wins, and what listeners are told.
 */
import { describe, expect, it, vi } from 'vitest';

import { activeLocale, setLocale, subscribeLocale } from './activeLocale';
import { replaceLoaders } from './catalogs';
import { t } from './translate';

/** A catalog whose one message starts with {@link tag}. */
function catalog(tag: string): unknown {
  return {
    commands: { not_signed_in_as: `${tag} {handle} {count, plural, other {{accounts}}}` },
  };
}

/** A loader that resolves to {@link messages}. */
function serving(messages: unknown): () => Promise<unknown> {
  return async () => await Promise.resolve(messages);
}

/** The refusal's arguments. */
const VALUES = { handle: 'zzz', count: 1, accounts: '@lain@wired.example' };

describe('loading a catalog', () => {
  it('loads each language once and makes it the language in use', async () => {
    const load = vi.fn(serving(catalog('ES')));
    replaceLoaders({ './locales/es.json': load });

    await Promise.all([setLocale('es'), setLocale('es')]);
    await setLocale('es');

    expect(load).toHaveBeenCalledTimes(1);
    expect(activeLocale()).toBe('es');
    expect(t('commands.not_signed_in_as', VALUES)).toBe('ES zzz @lain@wired.example');
  });

  it('activates a supported language with no file yet, with English messages', async () => {
    replaceLoaders({});

    await setLocale('ru');

    expect(activeLocale()).toBe('ru');
    expect(t('commands.not_signed_in_as', VALUES)).toContain("aren't signed in as zzz");
  });

  it('keeps English when the file fails to load, and tries again next time', async () => {
    const load = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog('JA'));
    replaceLoaders({ './locales/ja.json': load });

    await expect(setLocale('ja')).resolves.toBe(false);

    expect(activeLocale()).toBe('en');

    await expect(setLocale('ja')).resolves.toBe(true);

    expect(load).toHaveBeenCalledTimes(2);
    expect(activeLocale()).toBe('ja');
  });

  it('shows English for the messages of a file that is not a catalog', async () => {
    replaceLoaders({ './locales/zh-Hans.json': serving(['not', 'a catalog']) });

    await setLocale('zh-Hans');

    expect(activeLocale()).toBe('zh-Hans');
    expect(t('commands.not_signed_in_as', VALUES)).toContain("aren't signed in as zzz");
  });

  it('lets the later of two overlapping switches win', async () => {
    let finish: (messages: unknown) => void = () => undefined;
    replaceLoaders({
      './locales/de.json': async () =>
        await new Promise((resolve) => {
          finish = resolve;
        }),
    });

    const slow = setLocale('de');
    await setLocale('en');
    finish(catalog('DE'));
    await slow;

    expect(activeLocale()).toBe('en');
  });

  it('tells the listeners of a change, once, until they stop listening', async () => {
    replaceLoaders({ './locales/es.json': serving(catalog('ES')) });
    const listener = vi.fn();
    const stop = subscribeLocale(listener);

    await setLocale('es');
    await setLocale('es');
    stop();
    await setLocale('en');

    expect(listener).toHaveBeenCalledExactlyOnceWith();
  });
});
