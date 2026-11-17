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
 * is about. The module also answers the label a command prints for a resolved
 * post: the one of the line the window shows, boost wrapper included.
 */

import type { CommandContext } from './types';
import { lookupAccount } from '../api/endpoints/accountRead';
import { describeApiError } from '../api/errors';
import type { Account } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { type Result, err, ok } from '../lib/result';
import {
  labelForStatus,
  selectedStatus,
  statusForLabel,
  statusOfLine,
} from '../state/bufferSelection';
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
  /** The account the active window acts as. */
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
  /** The account the active window acts as. */
  readonly accountKey: string | null;
  /** That account's connection to its instance. */
  readonly session: ApiSession;
};

/** The active window's account and its session, or the refusal to run without one. */
function actingAs(context: CommandContext): Result<Acting, string> {
  const { state } = context;
  const accountKey = windowAccountKey(state, activeWindow(state.windows).id);
  const session = sessionFor(state, accountKey);
  return session === null ? err(NOT_LOGGED_IN_MESSAGE) : ok({ accountKey, session });
}

/** args, trimmed, split at the first whitespace into its leading word and what follows it. */
function splitFirstWord(args: string): readonly [word: string, rest: string] {
  const trimmed = args.trim();
  const gap = trimmed.search(/\s/u);
  return gap === -1 ? [trimmed, ''] : [trimmed.slice(0, gap), trimmed.slice(gap).trim()];
}

/** The status a boost shows instead of itself; any other status as it is. */
function displayed(status: Status): Status {
  return status.reblog ?? status;
}

/** The post the active window gave {@link word} as its label, or the refusal naming it. */
function labelledPost(context: CommandContext, word: string): Result<Status, string> {
  const status = statusForLabel(activeBuffer(context.state), word);
  return status === null ? err(`No post ${word} here`) : ok(status);
}

/** The post the active window's selection stands on, or the refusal to run without one. */
function selectedPost(context: CommandContext): Result<Status, string> {
  const status = selectedStatus(activeBuffer(context.state));
  return status === null ? err('Select a post first (j/k) or give a label') : ok(status);
}

/**
 * The post {@link args} names: its first word is a label when it looks like
 * one, and otherwise the active window's selection stands and all of args is
 * `rest`. A boost resolves to the original status.
 */
export function resolveStatusTarget(
  args: string,
  context: CommandContext,
): Result<StatusTarget, string> {
  const acting = actingAs(context);
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
    status: displayed(picked.value),
    rest: byLabel ? rest : args.trim(),
    ...acting.value,
  });
}

/**
 * The bracketed label of the active window's line that shows {@link status},
 * directly or as the original it boosts: the `[a3]` the post commands print, so
 * what they name is the line the user is looking at. The bare id for a status no
 * line carries, or for a window that never labelled it.
 */
export function targetLabel(context: CommandContext, status: Status): string {
  const buffer = activeBuffer(context.state);
  for (const line of buffer.lines) {
    const shown = statusOfLine(line);
    if (shown !== null && (shown === status || shown.reblog === status)) {
      return `[${labelForStatus(buffer, shown.id) ?? status.id}]`;
    }
  }
  return `[${status.id}]`;
}

/** The account named by {@link handle}, or the refusal quoting why the lookup failed. */
async function accountByHandle(
  handle: string,
  rest: string,
  acting: Acting,
): Promise<Result<AccountTarget, string>> {
  const found = await lookupAccount(acting.session, handle);
  if (!found.ok) {
    return err(`No account ${handle}: ${describeApiError(found.error)}`);
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
): Promise<Result<AccountTarget, string>> {
  const acting = actingAs(context);
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
    account: displayed(picked.value).account,
    rest: byLabel ? rest : args.trim(),
    ...acting.value,
  });
}
