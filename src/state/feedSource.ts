/**
 * The command grammar for feed sources (decision 14): `<who>:<source>` read
 * into source references — `@me@host:home` for one signed-in account,
 * `*:mentions` for every signed-in account, `@me@host:tag:rust` for a hashtag.
 * A failure is a readable message, not a throw.
 */

import { type FeedSourceRef, isFeedSource } from './feeds';
import type { StoredAccount } from '../accounts/accountStore';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';

/** The part of a signed-in account the command grammar needs. */
type SourceAccount = Pick<StoredAccount, 'key' | 'handle'>;

/** The accounts a `<who>` names: `*` is all of them, otherwise the one with that handle. */
function accountsNamed(
  who: string,
  accounts: readonly SourceAccount[],
): Result<readonly string[], string> {
  if (who === '*') {
    return accounts.length === 0
      ? err(t('state.no_account_signed_in'))
      : ok(accounts.map((a) => a.key));
  }
  const handle = who.replace(/^@/u, '').toLowerCase();
  const found = accounts.find((account) => account.handle.toLowerCase() === handle);
  return found === undefined ? err(t('state.no_signed_in_account', { handle })) : ok([found.key]);
}

/**
 * Read `<who>:<source>` — `@me@host:home`, `*:mentions` (every signed-in
 * account), `@me@host:tag:rust` — into one reference per account named.
 */
export function parseSource(
  text: string,
  accounts: readonly SourceAccount[],
): Result<readonly FeedSourceRef[], string> {
  const colon = text.indexOf(':');
  const source = text.slice(colon + 1);
  if (colon < 1 || !isFeedSource(source)) {
    return err(t('state.not_a_source', { text }));
  }
  const keys = accountsNamed(text.slice(0, colon), accounts);
  if (!keys.ok) {
    return keys;
  }
  return ok(keys.value.map((accountKey) => ({ accountKey, source })));
}
