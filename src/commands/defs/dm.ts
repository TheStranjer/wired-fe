/**
 * `/dm @user@host message` (alias `/msg`; decision 6, AGENTS.md "`/dm
 * @someone@example.com hey`"): say one line to somebody privately without
 * leaving the window you are in. The first word has to look like a handle —
 * `@user@host`, `user@host`, or `@user` for the acting instance's own people —
 * and everything after it is the message; anything else echoes the usage. The
 * active account signs the post (decision 8), sent as a mention of that handle
 * at `direct` visibility, and the fresh uuid is the idempotency key, so a
 * retried send stays one message. Success echoes the IRC `/msg` line,
 * `-> *@user@host* <text>`, and when a `dm` window for that handle is already
 * open the status the instance answered with joins its scrollback too, so the
 * writer sees their own words where the conversation lives. A failed create
 * comes back as what {@link describeApiError} says of it.
 */

import { createStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import type { Status } from '../../api/schemas/status';
import { statusesAction } from '../../state/pageActions';
import { sessionFor } from '../../state/selectors';
import type { WindowState } from '../../windows/model';
import { NOT_LOGGED_IN, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
const USAGE = '/dm @user@host message';

/** The message is up. */
const OK: CommandOutcome = { ok: true };

/** The argument text was not a handle and a message. */
const USAGE_ERROR: CommandOutcome = { ok: false, message: `Usage: ${USAGE}` };

/** A handle word: `@user@host`, `user@host`, or `@user` for the local instance. */
const HANDLE = /^@[\w.~-]+(?:@[\w.~-]+)?$|^[\w.~-]+@[\w.~-]+$/u;

/**
 * The handle word and the message word: {@link args} trimmed and split at its
 * first whitespace, null when there is no second word to send or the first does
 * not look like a handle. A trimmed string ends in a non-space, so a gap always
 * leaves a non-empty message; a line with no gap — a bare handle, or nothing —
 * is the same refusal.
 */
function splitHandleAndText(args: string): readonly [word: string, text: string] | null {
  const trimmed = args.trim();
  const gap = trimmed.search(/\s/u);
  if (gap === -1) {
    return null;
  }
  const word = trimmed.slice(0, gap);
  return HANDLE.test(word) ? [word, trimmed.slice(gap).trim()] : null;
}

/** The form the message mentions: always `@user@host`; dm windows drop the `@`. */
function mentionOf(word: string): string {
  return word.startsWith('@') ? word : `@${word}`;
}

/** {@link word} without its leading `@`: the form /query keys a dm window by. */
function bareHandle(word: string): string {
  return word.startsWith('@') ? word.slice(1) : word;
}

/**
 * The open `dm` window whose target is {@link mention} (any case, with or
 * without the leading `@` — /query keys its windows without one); null when
 * none is.
 */
function dmWindow(context: CommandContext, mention: string): WindowState | null {
  const wanted = bareHandle(mention).toLowerCase();
  return (
    context.windows.windows.find(
      (win) =>
        win.ref.kind === 'dm' &&
        win.ref.target !== null &&
        bareHandle(win.ref.target).toLowerCase() === wanted,
    ) ?? null
  );
}

/** Hand {@link status} to the open dm window for {@link mention}, when there is one. */
function addToDmWindow(context: CommandContext, mention: string, status: Status): void {
  const window = dmWindow(context, mention);
  if (window === null) {
    return;
  }
  context.dispatch(statusesAction(window.id, [status], 'newer'));
}

/** Send one direct mention as the active account, echo it, report failures. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const parts = splitHandleAndText(args);
  if (parts === null) {
    return USAGE_ERROR;
  }
  const [word, text] = parts;
  const mention = mentionOf(word);
  const session = sessionFor(context.state, context.state.activeAccountKey);
  if (session === null) {
    return NOT_LOGGED_IN;
  }
  const created = await createStatus(
    session,
    { status: `${mention} ${text}`, visibility: 'direct' },
    crypto.randomUUID(),
  );
  if (!created.ok) {
    return fail(describeApiError(created.error));
  }
  context.print(`-> *${mention}* ${text}`);
  addToDmWindow(context, mention, created.value);
  return OK;
}

/** The `/dm` (alias `/msg`) definition. */
export const command: CommandDefinition = {
  name: 'dm',
  aliases: ['msg'],
  usage: USAGE,
  summary: 'Send a direct message in one line',
  run: handle,
};
