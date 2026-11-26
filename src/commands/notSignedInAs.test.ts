/**
 * Tests for the shared refusal of an account the reader is not signed in as
 * (WFE-305): `/as`, `/account switch`, `/account logout`, `/sync` and
 * `/postas` all say the same sentence, whether no account, one or several are
 * signed in, and the sentence follows the language in use.
 */
import { describe, expect, it } from 'vitest';

import { command as account } from './defs/account';
import { command as as } from './defs/as';
import { command as postas } from './defs/postas';
import { command as sync } from './defs/sync';
import { notSignedInAs } from './notSignedInAs';
import type { CommandContext } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { fakeCommandContext } from '../test/commandContext';
import { installFakeLocale } from '../test/i18n';

/** The instance the accounts live on. */
const ORIGIN = 'https://wired.example';

/** The handles signed in, in order: none, one and two accounts. */
const NONE: readonly string[] = [];
const ONE = ['lain@wired.example'];
const SEVERAL = ['lain@wired.example', 'bob@wired.example'];

/** The sentence when {@link signed} is what follows "Signed in:" or the none branch. */
function refusal(signed: string): string {
  return `You aren't signed in as zzz. ${signed} Type /connect to add an account.`;
}

/** A context with an account per handle in {@link handles}. */
function signedIn(handles: readonly string[]): CommandContext {
  const context = fakeCommandContext();
  for (const [index, handle] of handles.entries()) {
    context.stores.accounts.add({
      origin: ORIGIN,
      accountId: String(index + 1),
      handle,
      token: `token-${handle}`,
      refreshToken: null,
      expiresAt: null,
    });
  }
  return context;
}

/** Every command that refuses an unknown handle, with the arguments naming `zzz`. */
const COMMANDS = [
  ['/as', as, 'zzz hello'],
  ['/account switch', account, 'switch zzz'],
  ['/account logout', account, 'logout zzz'],
  ['/sync primary', sync, 'primary zzz'],
  ['/sync fallback add', sync, 'fallback add zzz'],
  ['/postas', postas, 'zzz'],
] as const;

/** The three states of the account list and what the refusal says in each. */
const CASES = [
  ['no account', NONE, refusal('No account is signed in.')],
  ['one account', ONE, refusal('Signed in: @lain@wired.example.')],
  ['several accounts', SEVERAL, refusal('Signed in: @lain@wired.example, @bob@wired.example.')],
] as const;

describe('the refusal of an account the reader is not signed in as', () => {
  describe.each(COMMANDS)('%s', (_name, command, args) => {
    it.each(CASES)('says so with %s signed in', async (_state, handles, message) => {
      const outcome = await command.run(args, signedIn(handles));

      expect(outcome).toStrictEqual({ ok: false, message });
    });
  });

  it('follows the language in use', () => {
    installFakeLocale({
      commands: { not_signed_in_as: 'XX {handle}: {count, plural, other {{accounts}}}' },
    });
    const accounts: readonly StoredAccount[] = signedIn(ONE).stores.accounts.list();

    expect(notSignedInAs('zzz', accounts)).toStrictEqual({
      ok: false,
      message: 'XX zzz: @lain@wired.example',
    });
  });
});
