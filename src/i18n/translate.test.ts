/**
 * Tests for `t()`: English formatting with named arguments and a plural
 * branch, the typed key, the fallback to English when the language's message
 * is missing, does not parse or names other arguments than the source, and a
 * switch of language.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import { activeLocale } from './activeLocale';
import type { MessageKey } from './messages';
import { t, translate } from './translate';
import { FAKE_LOCALE, installFakeLocale, resetFakeLocale } from '../test/i18n';

/** The refusal's arguments with {@link count} accounts signed in. */
function refusal(count: number): { handle: string; count: number; accounts: string } {
  return { handle: 'zzz', count, accounts: '@lain@wired.example' };
}

describe(t, () => {
  it('formats the English source with named arguments', () => {
    expect(t('commands.not_signed_in_as', refusal(1))).toBe(
      "You aren't signed in as zzz. Signed in: @lain@wired.example. Type /connect to add an account.",
    );
  });

  it('takes the plural branch of the count', () => {
    expect(t('commands.not_signed_in_as', refusal(0))).toBe(
      "You aren't signed in as zzz. No account is signed in. Type /connect to add an account.",
    );
  });

  it('only accepts the keys of the English catalog', () => {
    expectTypeOf<'commands.not_signed_in_as'>().toExtend<MessageKey>();
    expectTypeOf<'commands.nope'>().not.toExtend<MessageKey>();
    expectTypeOf<'commands'>().not.toExtend<MessageKey>();

    expect(activeLocale()).toBe('en');
  });

  it('formats in the language in use and goes back to English', () => {
    installFakeLocale({
      commands: { not_signed_in_as: 'XX {handle} {count, plural, =0 {none} other {{accounts}}}' },
    });

    expect(activeLocale()).toBe(FAKE_LOCALE);
    expect(t('commands.not_signed_in_as', refusal(1))).toBe('XX zzz @lain@wired.example');

    resetFakeLocale();

    expect(activeLocale()).toBe('en');
    expect(t('commands.not_signed_in_as', refusal(0))).toContain('No account is signed in.');
  });

  it('formats the same message again from its cached formatter', () => {
    installFakeLocale({ commands: { not_signed_in_as: 'XX {handle} {count} {accounts}' } });

    expect(t('commands.not_signed_in_as', refusal(2))).toBe('XX zzz 2 @lain@wired.example');
    expect(t('commands.not_signed_in_as', refusal(3))).toBe('XX zzz 3 @lain@wired.example');
  });

  it('falls back to English for a key the language lacks', () => {
    installFakeLocale({ commands: {} });

    expect(t('commands.not_signed_in_as', refusal(1))).toContain("aren't signed in as zzz");
  });

  it('falls back to English for a message that does not parse', () => {
    installFakeLocale({ commands: { not_signed_in_as: 'XX {handle' } });

    expect(t('commands.not_signed_in_as', refusal(1))).toContain("aren't signed in as zzz");
  });

  it('falls back to English for a message whose arguments differ from the source', () => {
    installFakeLocale({ commands: { not_signed_in_as: 'XX {who}' } });

    expect(t('commands.not_signed_in_as', refusal(1))).toContain("aren't signed in as zzz");
  });

  it('falls back to English for a message that drops an argument of the source', () => {
    installFakeLocale({ commands: { not_signed_in_as: 'XX {handle}' } });

    expect(t('commands.not_signed_in_as', refusal(1))).toContain("aren't signed in as zzz");
  });

  it('falls back to English for a language whose catalog is not held', () => {
    expect(translate('de', 'commands.not_signed_in_as', refusal(1))).toContain(
      "aren't signed in as zzz",
    );
  });

  it('answers the key itself for a message only the other language has', () => {
    installFakeLocale({ commands: { extra: 'XX extra' } });

    expect(translate(FAKE_LOCALE, 'commands.extra')).toBe('commands.extra');
  });

  it('answers the key itself when not even English has the message', () => {
    expect(translate('en', 'commands.nope')).toBe('commands.nope');
    expect(translate('en', 'commands')).toBe('commands');
  });
});
