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
import { t } from '../../i18n/translate';
import { notSignedInAs } from '../notSignedInAs';
import { OK, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';
import { splitFirstWord } from '../words';

/** The argument text was not an account and a message. */
function usageError(): CommandOutcome {
  return fail(t('commands.defs.as.usage_error', { usage: t('commands.defs.as.usage') }));
}

/**
 * The account word and the text word: {@link args} trimmed and split at its
 * first whitespace; null when there is no second word to post. A trimmed
 * string ends in a non-space, so a gap always leaves a non-empty text.
 */
function splitAccountAndText(args: string): readonly [word: string, text: string] | null {
  const [word, text] = splitFirstWord(args);
  return text === '' ? null : [word, text];
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
  context.print(t('commands.defs.as.posted', { handle: account.handle }));
  return OK;
}

/** Find the named account and post once through it, or refuse. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const parts = splitAccountAndText(args);
  if (parts === null) {
    return usageError();
  }
  const [word, text] = parts;
  const accounts = context.stores.accounts.list();
  const account = findAccount(accounts, word);
  if (account === null) {
    return notSignedInAs(word, accounts);
  }
  return await postAs(context, account, text);
}

/** The `/as` definition. */
export const command: CommandDefinition = {
  name: 'as',
  get usage(): string {
    return t('commands.defs.as.usage');
  },
  get summary(): string {
    return t('commands.defs.as.summary');
  },
  run: handle,
};
