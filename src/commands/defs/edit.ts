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
 * retyped is what was written. A send carries only the text: the content
 * warning rides along as the post has it, since the line holds no place for it.
 */

import { getStatusSource } from '../../api/endpoints/statusSource';
import { editStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { hasFeature } from '../../capabilities/capabilities';
import { capabilitiesFor } from '../../state/selectors';
import { printedLabel } from '../statusLabel';
import { type StatusTarget, resolveOwnStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The edit left for the instance, or the source filled the line. */
const OK: CommandOutcome = { ok: true };

/** What an instance without the `editing` capability hears (decision 5). */
const NO_EDITING: CommandOutcome = {
  ok: false,
  message: 'This server does not support editing',
};

/** Whether {@link accountKey}'s instance takes edits at all (decision 5). */
function supportsEditing(context: CommandContext, accountKey: string | null): boolean {
  const capabilities = capabilitiesFor(context.state, accountKey);
  return capabilities !== null && hasFeature(capabilities, 'editing');
}

/** Send {@link text} as {@link target}'s new body, keeping the post's warning. */
async function send(
  target: StatusTarget,
  text: string,
  context: CommandContext,
): Promise<CommandOutcome> {
  const { status } = target;
  const edited = await editStatus(target.session, status.id, {
    status: text,
    spoilerText: status.spoiler_text,
  });
  if (!edited.ok) {
    return { ok: false, message: describeApiError(edited.error) };
  }
  context.dispatch({ type: 'statusUpdated', status: edited.value });
  context.print(`✎ edited [${printedLabel(context, status)}]`);
  return OK;
}

/** Fill the command line with the post's own source text so it can be retyped. */
async function refill(target: StatusTarget, context: CommandContext): Promise<CommandOutcome> {
  const source = await getStatusSource(target.session, target.status.id);
  if (!source.ok) {
    return { ok: false, message: describeApiError(source.error) };
  }
  context.setInput(`/edit ${printedLabel(context, target.status)} ${source.value.text}`);
  return OK;
}

/** Resolve this account's own editable post, then send its new text or refill. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveOwnStatusTarget(args, context, 'edit');
  if (!target.ok) {
    return { ok: false, message: target.error };
  }
  if (!supportsEditing(context, target.value.accountKey)) {
    return NO_EDITING;
  }
  const text = target.value.rest.trim();
  return text === ''
    ? await refill(target.value, context)
    : await send(target.value, text, context);
}

/** The `/edit` definition. */
export const command: CommandDefinition = {
  name: 'edit',
  usage: '/edit [label] [text]',
  summary: 'Edit one of your own posts',
  run: async (args, context) => await handle(args, context),
  bindings: [{ mode: 'navigation', chord: 'e', args: '{label}', prefill: true }],
};
