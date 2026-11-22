/**
 * `/tag <name>` (aliases `/join` and `/t`; decision 6, AGENTS.md "Windows, like
 * IRC buffers"): join a hashtag — open that tag's timeline as its own window,
 * the way IRC's `/join #channel` opens a channel buffer. A leading `#` is
 * optional, so `/tag lain` and `/tag #lain` are the same window; the name must
 * otherwise be letters, digits and underscores, and it is lowercased, which is
 * what makes opening a tag twice find the window that already shows it — the
 * window reducer activates that one instead of adding a second. The window is
 * titled `#<name>`, and plain text typed into it posts with the tag appended
 * when the post does not already carry it (src/features/hashtag). Without an
 * account there is no session to ask for the timeline, so after the name is
 * checked the command says what to type instead.
 */

import { hashtagWindowOpen } from '../../state/hashtagWindow';
import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** A hashtag name once its optional `#` is off: letters, digits, underscores. */
const TAG = /^[\p{L}\p{N}_]+$/u;

/** The window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** The argument trimmed, minus one leading `#` if it has one. */
function tagName(args: string): string {
  const trimmed = args.trim();
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
}

/** Check the name, then ask the window list for the active account's tag window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const name = tagName(args);
  if (!TAG.test(name)) {
    return fail(`Not a hashtag: ${args.trim()}`);
  }
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows(hashtagWindowOpen(name.toLowerCase(), account.key));
  return OK;
}

/** The `/tag` (aliases `/join`, `/t`) definition. */
export const command: CommandDefinition = {
  name: 'tag',
  aliases: ['join', 't'],
  usage: '/tag <name>',
  summary: 'Open a hashtag timeline',
  run: syncRun(handle),
};
