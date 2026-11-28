/**
 * The target resolvers the post and account commands share (decision 6,
 * AGENTS.md "Every post has a short label"): they turn the argument text a
 * command was given into the one post or account it acts on, the session to
 * act through, and the argument text left over for the command to use. A
 * first word shaped like a label (`a3`, any case) names a post of the active
 * window's scrollback; `@user@host` names an account the instance looks up;
 * a word that is neither — or no word at all — leaves the post the
 * navigation mode selected to stand. A boost resolves to the original status
 * and to its author: the booster showed the post, it is not what the post
 * is about. ./ownTarget puts this account's authorship on top of that
 * resolution, for the commands that may change only its own posts. A command
 * that only reads says so (`'read'`); every other is refused in a signed-out
 * window (WFE-340).
 */

import type { CommandContext } from './types';
import { splitFirstWord } from './words';
import { findAccountByHandle } from '../api/endpoints/accountRead';
import { describeApiError } from '../api/errors';
import type { Account } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';
import { isAnonKey } from '../state/anonAccount';
import { type LineStatus, lineStatusForLabel, selectedLineStatus } from '../state/bufferSelection';
import { activeBuffer, sessionFor, windowAccountKey } from '../state/selectors';
import { activeWindow } from '../windows/model';

/** A first argument word that could be a post label: letters, then digits. */
const LABEL_WORD = /^[a-z]+[0-9]$/iu;

/** What every target carries: the acting window's account and its session. */
type Acting = {
  readonly accountKey: string | null;
  readonly session: ApiSession;
};

/** The post a command acts on, and what to do with it (decision 6). */
export type StatusTarget = {
  /** The post itself: the boosted original, when the named or selected line is a boost. */
  readonly status: Status;
  /** The argument text after a consumed label; all of it when the selection stood. */
  readonly rest: string;
  /** The account that fetched the line, else the one the active window acts as. */
  readonly accountKey: string | null;
  /** That account's connection to its instance. */
  readonly session: ApiSession;
};

/** The account a command acts on, and what to do with it (decision 6). */
export type AccountTarget = {
  /** The account itself: the author of the boosted original, when a label or selection named a boost. */
  readonly account: Account;
  /** The argument text after a consumed handle or label; all of it when the selection stood. */
  readonly rest: string;
  /** The account that fetched the line, else the one the active window acts as. */
  readonly accountKey: string | null;
  /** That account's connection to its instance. */
  readonly session: ApiSession;
};

/**
 * What a command does with its target: `act` changes something as an account
 * (favourite, boost, reply, follow...), `read` only looks (open, copy,
 * thread...). The default is `act`, so a command added later is refused in a
 * signed-out window unless it says it only reads.
 */
export type TargetUse = 'act' | 'read';

/**
 * The active window's account and its session, or the refusal to run without
 * one. The one place commands resolve an account for a line: a signed-out
 * window (WFE-340, ./state/anonAccount) has none to act as, so an `act` is
 * refused here with the one sign-in message, and sends no request.
 */
function actingAs(context: CommandContext, use: TargetUse): Result<Acting, string> {
  const { state } = context;
  const accountKey = windowAccountKey(state, activeWindow(state.windows).id);
  if (use === 'act' && isAnonKey(accountKey)) {
    return err(t('commands.sign_in_to_act'));
  }
  const session = sessionFor(state, accountKey);
  return session === null ? err(t('commands.not_logged_in')) : ok({ accountKey, session });
}

/** The status a boost shows instead of itself; any other status as it is. */
function displayed(status: Status): Status {
  return status.reblog ?? status;
}

/**
 * The account a command on a line acts as (decision 14): the one that fetched
 * the line when it is still signed in, else {@link fallback}, the window's.
 */
function actingForLine(context: CommandContext, fallback: Acting, lineKey: string | null): Acting {
  const session = isAnonKey(lineKey) ? null : sessionFor(context.state, lineKey);
  return session === null ? fallback : { accountKey: lineKey, session };
}

/** The post the active window gave {@link word} as its label, or the refusal naming it. */
function labelledPost(context: CommandContext, word: string): Result<LineStatus, string> {
  const found = lineStatusForLabel(activeBuffer(context.state), word);
  return found === null ? err(t('commands.no_post_here', { label: word })) : ok(found);
}

/** The post the active window's selection stands on, or the refusal to run without one. */
function selectedPost(context: CommandContext): Result<LineStatus, string> {
  const found = selectedLineStatus(activeBuffer(context.state));
  return found === null ? err(t('commands.select_post_first')) : ok(found);
}

/**
 * The post {@link args} names: its first word is a label when it looks like
 * one, and otherwise the active window's selection stands and all of args is
 * `rest`. A boost resolves to the original status.
 */
export function resolveStatusTarget(
  args: string,
  context: CommandContext,
  use: TargetUse = 'act',
): Result<StatusTarget, string> {
  const acting = actingAs(context, use);
  if (!acting.ok) {
    return acting;
  }
  const [word, rest] = splitFirstWord(args);
  const byLabel = LABEL_WORD.test(word);
  const picked = byLabel ? labelledPost(context, word) : selectedPost(context);
  if (!picked.ok) {
    return picked;
  }
  return ok({
    status: displayed(picked.value.status),
    rest: byLabel ? rest : args.trim(),
    ...actingForLine(context, acting.value, picked.value.accountKey),
  });
}

/** The account named by {@link handle}, or the refusal quoting why the lookup failed. */
async function accountByHandle(
  handle: string,
  rest: string,
  acting: Acting,
): Promise<Result<AccountTarget, string>> {
  const found = await findAccountByHandle(acting.session, handle);
  if (!found.ok) {
    return err(t('commands.no_account_lookup', { handle, error: describeApiError(found.error) }));
  }
  return ok({ account: found.value, rest, ...acting });
}

/**
 * The account {@link args} names: its first word is a handle when it holds an
 * `@` — looked up through the acting account's session — a label when it
 * looks like one, and otherwise the author of the active window's selected
 * post stands and all of args is `rest`. A boost names the boosted author.
 */
export async function resolveAccountTarget(
  args: string,
  context: CommandContext,
  use: TargetUse = 'act',
): Promise<Result<AccountTarget, string>> {
  const acting = actingAs(context, use);
  if (!acting.ok) {
    return acting;
  }
  const [word, rest] = splitFirstWord(args);
  if (word.includes('@')) {
    return await accountByHandle(word, rest, acting.value);
  }
  const byLabel = LABEL_WORD.test(word);
  const picked = byLabel ? labelledPost(context, word) : selectedPost(context);
  if (!picked.ok) {
    return picked;
  }
  return ok({
    account: displayed(picked.value.status).account,
    rest: byLabel ? rest : args.trim(),
    ...actingForLine(context, acting.value, picked.value.accountKey),
  });
}
