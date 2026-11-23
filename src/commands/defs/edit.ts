/**
 * `/edit` (decision 6): rewrite one of this account's own posts, where the
 * instance supports editing (decision 5: `capabilitiesFor` and `hasFeature`,
 * the same gate the reactions use). The target resolves the way the other post
 * commands resolve theirs and the author check is on top: a boost is the
 * boosted author's text, so it is not this account's to revise.
 *
 * `e` prefills the line with the selected post's label; typing the new text
 * after it and Enter sends it. With no text the command instead reads the
 * post's source — the plain text its author wrote, not the HTML the timeline
 * renders — and fills `/edit a3 <that text>` into the command line, so what is
 * retyped is what was written. A send carries the new text and the rest of the
 * post as it stands (see ./editFields): the line holds no place for the
 * content warning, media or poll, and Mastodon drops what an edit leaves out.
 */

import { getStatusSource } from '../../api/endpoints/statusSource';
import { editStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { type Capabilities, hasFeature } from '../../capabilities/capabilities';
import { capabilitiesFor } from '../../state/selectors';
import { editFields } from '../editFields';
import { OK, fail } from '../outcome';
import { printedLabel } from '../statusLabel';
import { type StatusTarget, resolveOwnStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** What an instance without the `editing` capability hears (decision 5). */
const NO_EDITING = fail('This server does not support editing');

/** The capabilities of {@link accountKey}'s instance when it takes edits at all (decision 5). */
function editingCapabilities(
  context: CommandContext,
  accountKey: string | null,
): Capabilities | null {
  const capabilities = capabilitiesFor(context.state, accountKey);
  return capabilities !== null && hasFeature(capabilities, 'editing') ? capabilities : null;
}

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
  context.print(`✎ edited [${printedLabel(context, status)}]`);
  return OK;
}

/** Fill the command line with the post's own source text so it can be retyped. */
async function refill(target: StatusTarget, context: CommandContext): Promise<CommandOutcome> {
  const source = await getStatusSource(target.session, target.status.id);
  if (!source.ok) {
    return fail(describeApiError(source.error));
  }
  context.setInput(`/edit ${printedLabel(context, target.status)} ${source.value.text}`);
  return OK;
}

/** Resolve this account's own editable post, then send its new text or refill. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveOwnStatusTarget(args, context, 'edit');
  if (!target.ok) {
    return fail(target.error);
  }
  const capabilities = editingCapabilities(context, target.value.accountKey);
  if (capabilities === null) {
    return NO_EDITING;
  }
  const text = target.value.rest.trim();
  return text === ''
    ? await refill(target.value, context)
    : await send(target.value, text, { context, capabilities });
}

/** The `/edit` definition. */
export const command: CommandDefinition = {
  name: 'edit',
  usage: '/edit [label] [text]',
  summary: 'Edit one of your own posts',
  run: async (args, context) => await handle(args, context),
  bindings: [{ mode: 'navigation', chord: 'e', args: '{label}', prefill: true }],
};
