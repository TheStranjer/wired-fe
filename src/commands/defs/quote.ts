/**
 * `/quote [label] [text]` (decision 6, WBE-91, WFE-262): post a new status
 * that quotes an existing one. The post resolves the way the other post
 * commands resolve theirs — a leading label names a post of the active
 * window's scrollback, otherwise the navigation selection stands, and a boost
 * quotes its original — and the text is everything left over. The instance
 * must carry the acting account's `quotePosting` flag (decision 5); where it
 * does not, the command refuses before anything is posted. Like `/reply` it
 * does not post through the active window, whose kind may take no posts
 * (a feed, notifications, a profile) or reshape them (a thread makes it a
 * reply, a dm a direct message): the status is created through
 * {@link createStatus} as the quoted post's account, with `quote_id` and the
 * reader's default audience, and joins the active window only when that shows
 * one of this account's conversations. Success prints `❝ quoted [a3]`, naming
 * the line the window shows; a failed create — Mastodon refuses to quote a
 * direct or private post — comes back as what {@link describeApiError} says of
 * it. `q` prefills the line with the selected post's label; type the comment
 * and Enter sends it. With no text — `/quote a3`, the card's quote button,
 * `Shift+c` (`Shift+q` is `/close`'s) — it opens a quote composer instead
 * (WFE-262): a composer window bound to the post, as the line's account; it
 * opens where `--in`, `openIn.composer` or `replyIn` (default `split`) say.
 */

import { createStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { requireFeature } from '../../capabilities/requireFeature';
import { composerWindowFor } from '../../state/composerWindow';
import { draftToNewStatus } from '../../state/draft';
import type { Placement } from '../../state/placement';
import { windowId } from '../../windows/model';
import { openReplyWindow, splitPlacement } from '../openWindowRun';
import { OK, fail } from '../outcome';
import { addToActiveWindow, wantsComposer } from '../ownStream';
import { targetLabel } from '../statusLabel';
import { type StatusTarget, resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** How to call the command; echoed by /help. */
const USAGE = '/quote [label] [text]';

/** Open a composer window bound to {@link target}'s post, placed as {@link override} and the settings say. */
function openComposer(
  context: CommandContext,
  target: StatusTarget,
  override: Placement | null,
): CommandOutcome {
  const open = composerWindowFor(target.accountKey, context.windows.windows);
  openReplyWindow(context, open, override);
  context.dispatch({
    type: 'composerEdit',
    windowId: windowId(open.ref),
    patch: { quoteOf: { status: target.status, accountKey: target.accountKey } },
  });
  return OK;
}

/** Create the quote of {@link target}'s post as its account, echo, report. */
async function post(
  context: CommandContext,
  target: StatusTarget,
  text: string,
): Promise<CommandOutcome> {
  const payload = draftToNewStatus(
    { text, quoteId: target.status.id },
    context.state.settings.defaultVisibility,
  );
  const created = await createStatus(target.session, payload, crypto.randomUUID());
  if (!created.ok) {
    return fail(describeApiError(created.error));
  }
  addToActiveWindow(context, created.value);
  context.print(`❝ quoted ${targetLabel(context, target.status)}`);
  return OK;
}

/** Resolve the quoted post, gate on the capability, then post the text or open the composer. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const quoting = requireFeature(context, target.value.accountKey, 'quotePosting');
  if (!quoting.ok) {
    return fail(quoting.error);
  }
  const text = target.value.rest.trim();
  if (!wantsComposer(text)) {
    return await post(context, target.value, text);
  }
  const placed = splitPlacement(text);
  return placed.ok
    ? openComposer(context, target.value, placed.value.placement)
    : fail(placed.error);
}

/** The `/quote` definition. */
export const command: CommandDefinition = {
  name: 'quote',
  usage: USAGE,
  summary: 'Quote a post; with no text, open a composer (q prefills, Shift+c composes)',
  requires: 'quotePosting',
  run: handle,
  bindings: [
    { mode: 'navigation', chord: 'q', args: '{label}', prefill: true },
    { mode: 'navigation', chord: 'Shift+c', args: '' },
  ],
};
