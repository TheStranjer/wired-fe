/**
 * `/as <handle|n> <text>` (decision 6, decision 8, AGENTS.md "`/as
 * @me@other.example <text>`"): say one line as another account without
 * becoming it. The first word names a stored account the way `/account
 * switch` names one — a 1-based number, a full handle, a unique username
 * prefix — and everything after it is the post, created through that
 * account's own session with the reader's default audience. The active
 * account stays where it was, and the status is not pushed into any
 * scrollback: the active window belongs to another account and shows its own
 * instance's stream.
 */

import type { StoredAccount } from '../../accounts/accountStore';
import { findAccount } from '../../accounts/findAccount';
import { createStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
const USAGE = '/as <handle|n> <text>';

/** The post is up under the named account. */
const OK: CommandOutcome = { ok: true };

/** The argument text was not an account and a message. */
const USAGE_ERROR: CommandOutcome = { ok: false, message: `Usage: ${USAGE}` };

/**
 * The account word and the text word: {@link args} trimmed and split at its
 * first whitespace; null when there is no second word to post. A trimmed
 * string ends in a non-space, so a gap always leaves a non-empty text.
 */
function splitAccountAndText(args: string): readonly [word: string, text: string] | null {
  const trimmed = args.trim();
  const gap = trimmed.search(/\s/u);
  if (gap === -1) {
    return null;
  }
  return [trimmed.slice(0, gap), trimmed.slice(gap).trim()];
}

/**
 * Post {@link text} once as {@link account}: its own origin and token make
 * the session, the reader's default audience the visibility. The fresh
 * uuid is the idempotency key, so a retried send stays one post.
 */
async function postAs(
  context: CommandContext,
  account: StoredAccount,
  text: string,
): Promise<CommandOutcome> {
  const created = await createStatus(
    { origin: account.origin, token: account.token },
    { status: text, visibility: context.state.settings.defaultVisibility },
    crypto.randomUUID(),
  );
  if (!created.ok) {
    return fail(describeApiError(created.error));
  }
  context.print(`posted as @${account.handle}`);
  return OK;
}

/** Find the named account and post once through it, or refuse. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const parts = splitAccountAndText(args);
  if (parts === null) {
    return USAGE_ERROR;
  }
  const [word, text] = parts;
  const account = findAccount(context.stores.accounts.list(), word);
  if (account === null) {
    return fail(`No account ${word}`);
  }
  return await postAs(context, account, text);
}

/** The `/as` definition. */
export const command: CommandDefinition = {
  name: 'as',
  aliases: [],
  usage: USAGE,
  summary: 'Post one line as another account',
  run: async (args, context) => await handle(args, context),
};
