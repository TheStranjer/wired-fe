/**
 * The body the six account toggles share (decision 6): `/follow`, `/block`
 * and `/mute` attach the window's account to another one, and each has an
 * `un…` command that takes the attach back. The account resolves the way the
 * other account commands resolve theirs — a handle the instance looks up, a
 * leading label or the navigation selection's author, a boost naming its
 * boosted author, as `resolveAccountTarget` describes — and acting on
 * yourself is refused before anything is sent. One
 * `POST /api/v1/accounts/<id>/<action>` follows; the relationship the
 * instance answers is printed with the word the command was given, save a
 * follow the locked target has yet to accept, which reads `follow
 * requested`. `/mute` takes a duration word — `30m`, `2h`, `7d`, parsed here
 * and sent as seconds; no word means forever — which the line echoes. A
 * failed call comes back as the API error it is, with nothing printed.
 */

import { fail } from './outcome';
import { resolveAccountTarget } from './targets';
import type { CommandDefinition } from './types';
import { type AccountAction, accountAction } from '../api/endpoints/accountActions';
import { describeApiError } from '../api/errors';
import type { Relationship } from '../api/schemas/relationship';
import { type Result, err, ok } from '../lib/result';
import { accountByKey } from '../state/selectors';

/** A duration word: digits run, then one of the unit letters. */
const DURATION_WORD = /^(\d+)([mhd])$/u;

/** A mute's duration: seconds to send, and the word the printed line echoes. */
type MuteDuration = readonly [seconds: number, word: string];

/** How many seconds each duration unit letter counts. */
const UNIT_SECONDS: Record<'m' | 'h' | 'd', number> = { m: 60, h: 3600, d: 86400 };

/**
 * The mute duration {@link args} asks for: nothing left after the target
 * means forever, a first word shaped `30m`, `2h` or `7d` counts out its
 * seconds, and anything else is refused naming that word.
 */
export function parseMuteDuration(args: string): Result<MuteDuration | null, string> {
  const trimmed = args.trim();
  if (trimmed === '') {
    return ok(null);
  }
  const gap = trimmed.search(/\s/u);
  const word = gap === -1 ? trimmed : trimmed.slice(0, gap);
  const parts = DURATION_WORD.exec(word);
  if (parts === null) {
    return err(`Bad duration: ${word}`);
  }
  const unit = parts[2] as keyof typeof UNIT_SECONDS;
  return ok([Number(parts[1]) * UNIT_SECONDS[unit], word]);
}

/** The word a toggle prints: a follow the target must first accept says so. */
function doneWord(action: AccountAction, word: string, rel: Relationship): string {
  return action === 'follow' && rel.requested ? 'follow requested' : word;
}

/**
 * The run {@link action} gives its command, printing the success
 * {@link word}: resolve the account, refuse to act on yourself, send the
 * action — with a mute's parsed duration, invalid words refused before
 * anything goes out — and print the relationship the instance answered
 * with, the mute's word echoed as its span.
 */
export function accountToggleRun(action: AccountAction, word: string): CommandDefinition['run'] {
  return async (args, context) => {
    const target = await resolveAccountTarget(args, context);
    if (!target.ok) {
      return fail(target.error);
    }
    const { account, rest, accountKey, session } = target.value;
    if (accountByKey(context.state, accountKey)?.accountId === account.id) {
      return fail("That's you");
    }
    const duration: Result<MuteDuration | null, string> =
      action === 'mute' ? parseMuteDuration(rest) : ok(null);
    if (!duration.ok) {
      return fail(duration.error);
    }
    const answered = await accountAction(
      session,
      account.id,
      action,
      duration.value === null ? {} : { duration: duration.value[0] },
    );
    if (!answered.ok) {
      return fail(describeApiError(answered.error));
    }
    const line = `${doneWord(action, word, answered.value)} @${account.acct}`;
    context.print(duration.value === null ? line : `${line} for ${duration.value[1]}`);
    return { ok: true };
  };
}
