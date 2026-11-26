/**
 * `/edit` (decision 6): rewrite one of this account's own posts, where the
 * instance supports editing (decision 5: `capabilitiesFor` and `hasFeature`,
 * the same gate the reactions use). The target resolves the way the other post
 * commands resolve theirs and the author check is on top: a boost is the
 * boosted author's text, so it is not this account's to revise.
 *
 * `e` prefills the line with the selected post's label; typing the new text
 * after it and Enter sends it. A send carries the new text and the rest of the
 * post as it stands (see ./editFields): the line holds no place for the
 * content warning, media or poll, and Mastodon drops what an edit leaves out.
 * With no text — `/edit a3`, the card's `⋯` → Edit — the command instead reads
 * the post's source (the plain text its author wrote, not the HTML the timeline
 * renders) and opens a composer window bound to the post (WFE-268), as the
 * line's account, holding that text and the post's content warning, where
 * `--in`, `openIn.composer` or `replyIn` (default `split`) say; the composer's
 * send saves the edit and keeps the media and the poll.
 */

import { getStatusSource } from '../../api/endpoints/statusSource';
import { editStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import type { Capabilities } from '../../capabilities/capabilities';
import { requireFeature } from '../../capabilities/requireFeature';
import { t } from '../../i18n/translate';
import { composerWindowFor } from '../../state/composerWindow';
import type { Placement } from '../../state/placement';
import { windowId } from '../../windows/model';
import { editFields } from '../editFields';
import { openReplyWindow, splitPlacement } from '../openWindowRun';
import { OK, fail } from '../outcome';
import { wantsComposer } from '../ownStream';
import { printedLabel } from '../statusLabel';
import { type StatusTarget, resolveOwnStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Send {@link text} as {@link target}'s new body, keeping the rest of the post. */
async function send(
  target: StatusTarget,
  text: string,
  deps: { readonly context: CommandContext; readonly capabilities: Capabilities },
): Promise<CommandOutcome> {
  const { context, capabilities } = deps;
  const { status } = target;
  const fields = editFields(status, capabilities.pollLimits, context.now());
  if (!fields.ok) {
    return fail(fields.error);
  }
  const edited = await editStatus(target.session, status.id, { ...fields.value, status: text });
  if (!edited.ok) {
    return fail(describeApiError(edited.error));
  }
  context.dispatch({ type: 'statusUpdated', status: edited.value });
  context.print(t('commands.defs.edit.edited', { label: printedLabel(context, status) }));
  return OK;
}

/**
 * Open a composer window bound to {@link target}'s post, placed as
 * {@link override} and the settings say, holding the post's source text and
 * content warning. A source read the instance turns down opens nothing.
 */
async function openComposer(
  context: CommandContext,
  target: StatusTarget,
  override: Placement | null,
): Promise<CommandOutcome> {
  const source = await getStatusSource(target.session, target.status.id);
  if (!source.ok) {
    return fail(describeApiError(source.error));
  }
  const open = composerWindowFor(target.accountKey, context.windows.windows);
  openReplyWindow(context, open, override);
  context.dispatch({
    type: 'composerEdit',
    windowId: windowId(open.ref),
    patch: {
      text: source.value.text,
      spoiler: source.value.spoiler_text,
      visibility: target.status.visibility,
      editing: { status: target.status, accountKey: target.accountKey },
    },
  });
  return OK;
}

/** Resolve this account's own editable post, then send its new text or open the composer. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveOwnStatusTarget(args, context, 'edit');
  if (!target.ok) {
    return fail(target.error);
  }
  const editing = requireFeature(context, target.value.accountKey, 'editing');
  if (!editing.ok) {
    return fail(editing.error);
  }
  const text = target.value.rest.trim();
  if (!wantsComposer(text)) {
    return await send(target.value, text, { context, capabilities: editing.value });
  }
  const placed = splitPlacement(text);
  return placed.ok
    ? await openComposer(context, target.value, placed.value.placement)
    : fail(placed.error);
}

/** The `/edit` definition. */
export const command: CommandDefinition = {
  name: 'edit',
  get usage(): string {
    return t('commands.defs.edit.usage');
  },
  get summary(): string {
    return t('commands.defs.edit.summary');
  },
  requires: 'editing',
  run: async (args, context) => await handle(args, context),
  bindings: [{ mode: 'navigation', chord: 'e', args: '{label}', prefill: true }],
};
