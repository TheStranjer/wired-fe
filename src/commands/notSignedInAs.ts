/**
 * The refusal of a command that names an account the reader is not signed in
 * as (decision 19): `/as`, `/account switch|logout`, `/sync` and `/postas`
 * all turn the reader down with the same sentence, which says what is wrong
 * (not signed in as that handle, not "no such account"), lists who is signed
 * in and points to `/connect`.
 */

import { fail } from './outcome';
import type { CommandOutcome } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { t } from '../i18n/translate';

/** The failure for {@link handle}, the account word as typed, given the signed-in {@link accounts}. */
export function notSignedInAs(handle: string, accounts: readonly StoredAccount[]): CommandOutcome {
  const signedIn = accounts.map((account) => `@${account.handle}`).join(', ');
  return fail(
    t('commands.not_signed_in_as', { handle, count: accounts.length, accounts: signedIn }),
  );
}
