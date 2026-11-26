/**
 * Signing out and the feeds (WFE-243, decision 14): an account that leaves the
 * account list takes its sources out of every saved feed, so no feed keeps
 * reading as someone who is gone. Feeds left empty stay. It also stops being
 * the account any feed, or the settings, post as (WFE-281).
 */

import { mergedSettings } from './appReducer';
import { dropAccount } from './feeds';
import type { Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';

/** The two parts of the app state this step reads and writes. */
type SignedOutSlice = {
  readonly accounts: readonly StoredAccount[];
  readonly settings: Settings;
};

/**
 * {@link after} with the sources of every account {@link before} had and
 * {@link after} lost taken out of the feeds, and out of the posting defaults
 * naming them; the same state when none left.
 */
export function dropSignedOut<S extends SignedOutSlice>(before: S, after: S): S {
  const gone = before.accounts.filter(
    (account) => !after.accounts.some((kept) => kept.key === account.key),
  );
  if (gone.length === 0) {
    return after;
  }
  const feeds = gone.reduce(
    (rest, account) => dropAccount(rest, account.key),
    after.settings.feeds,
  );
  const postAs = gone.some((account) => account.key === after.settings.postAs)
    ? null
    : after.settings.postAs;
  return { ...after, settings: mergedSettings(after.settings, { feeds, postAs }) };
}
