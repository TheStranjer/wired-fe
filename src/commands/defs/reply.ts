/**
 * `/reply [label] [text]` (alias `/r`; decision 6, AGENTS.md navigation mode
 * "`r` reply"): answer one post in one line from wherever you are. The post
 * resolves the way the other post commands resolve theirs — a leading label
 * names a post of the active window's scrollback, otherwise the navigation
 * selection stands, and a boost answers its original. The draft is
 * {@link replyDraft}'s: it @-names the respondents the answer must address,
 * keeps the audience of a direct, private or unlisted post and carries its
 * content warning; the reader's default audience fills the rest. The active
 * window's own account signs the create through {@link createStatus}, and the
 * status the instance answers joins that very window when it shows one of
 * this account's conversations — a timeline, a thread or a dm window; the
 * target resolved from it, so it is the account the reply belongs to. Success
 * prints `↳ replied to [a3]`, naming the line the window shows; a failed
 * create comes back as what {@link describeApiError} says of it. `r` prefills
 * the line with the selected post's label; type the answer and Enter sends it.
 * With no text — `/reply a3`, the card's reply button, `Shift+r` — it opens a
 * reply composer instead (WFE-244): a composer window bound to the post, as the
 * line's account, its text holding the mentions, its audience the post's
 * capped by the default and its content warning the post's; it opens where
 * `--in`, `openIn.composer` or `replyIn` (default `split`) say.
 */

import { type NewStatus, createStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { composerWindowFor } from '../../state/composerWindow';
import { draftToNewStatus } from '../../state/draft';
import type { Placement } from '../../state/placement';
import { replyDraft, replyFields } from '../../state/replyDraft';
import { accountByKey } from '../../state/selectors';
import { windowId } from '../../windows/model';
import { openReplyWindow, splitPlacement } from '../openWindowRun';
import { OK, fail } from '../outcome';
import { addToActiveWindow, wantsComposer } from '../ownStream';
import { targetLabel } from '../statusLabel';
import { type StatusTarget, resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bare label echoes it. */
const USAGE = '/reply [label] [text]';

/** The handle the {@link accountKey} account replies under; none while unknown. */
function ownHandle(context: CommandContext, accountKey: string | null): string {
  return accountByKey(context.state, accountKey)?.handle ?? '';
}

/** The create payload answering {@link target}'s post with {@link text}. */
function answerWith(context: CommandContext, target: StatusTarget, text: string): NewStatus {
  const draft = replyDraft(target.status, ownHandle(context, target.accountKey), text);
  return draftToNewStatus(draft, context.state.settings.defaultVisibility);
}

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
    patch: replyFields(target.status, {
      ownAcct: ownHandle(context, target.accountKey),
      accountKey: target.accountKey,
      defaultVisibility: context.state.settings.defaultVisibility,
    }),
  });
  return OK;
}

/** Resolve the post, create the answer as its window's account, echo, report. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const { status, rest, session } = target.value;
  const text = rest.trim();
  if (wantsComposer(text)) {
    const placed = splitPlacement(text);
    return placed.ok
      ? openComposer(context, target.value, placed.value.placement)
      : fail(placed.error);
  }
  const created = await createStatus(
    session,
    answerWith(context, target.value, text),
    crypto.randomUUID(),
  );
  if (!created.ok) {
    return fail(describeApiError(created.error));
  }
  addToActiveWindow(context, created.value);
  context.print(`↳ replied to ${targetLabel(context, status)}`);
  return OK;
}

/** The `/reply` (alias `/r`) definition. */
export const command: CommandDefinition = {
  name: 'reply',
  aliases: ['r'],
  usage: USAGE,
  summary: 'Reply in one line; with no text, open a composer (r prefills, Shift+r composes)',
  run: handle,
  bindings: [
    { mode: 'navigation', chord: 'r', args: '{label}', prefill: true },
    { mode: 'navigation', chord: 'Shift+r', args: '' },
  ],
};
