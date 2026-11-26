/**
 * Tests that the command rows follow the language (WFE-310): a summary that
 * is translated text is read when the row is described, so a provider built
 * before a switch describes in the language in use after it.
 */
import { describe, expect, it } from 'vitest';

import { commandProvider } from './commandProvider';
import { command as lang } from './defs/lang';
import type { Registry } from './types';
import { installFakeLocale } from '../test/i18n';

/** A registry holding only `/lang`. */
const REGISTRY: Registry = { commands: [lang], byName: new Map() };

describe('commandProvider in another language', () => {
  it('describes the summary of a command in the language it is asked in', () => {
    const provider = commandProvider(REGISTRY);

    expect(provider.describe?.('/lang')?.description).toBe('Show or choose the interface language');

    installFakeLocale({ commands: { defs: { lang: { summary: 'XX summary' } } } });

    expect(provider.describe?.('/lang')).toStrictEqual({
      word: '/lang',
      label: '/lang (/language)',
      description: 'XX summary',
    });
    expect(provider.describe?.('/language')?.description).toBe('XX summary');
  });
});
