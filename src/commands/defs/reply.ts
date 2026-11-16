/**
 * `/reply [label] <text>` (alias `/r`; decision 6, AGENTS.md navigation mode
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
 */

import { type NewStatus, createStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import type { Status } from '../../api/schemas/status';
import { draftToNewStatus } from '../../state/draft';
import { replyDraft } from '../../state/replyDraft';
import { accountByKey } from '../../state/selectors';
import { type WindowKind, activeWindow } from '../../windows/model';
import { type StatusTarget, resolveStatusTarget, targetLabel } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bare label echoes it. */
const USAGE = '/reply [label] <text>';

/** The answer is up and the window knows it. */
const OK: CommandOutcome = { ok: true };

/** The window kinds that show one account's conversation and take posts. */
const FEED_KINDS: ReadonlySet<WindowKind> = new Set<WindowKind>([
  'home',
  'local',
  'federated',
  'hashtag',
  'thread',
  'dm',
]);

/** A failure saying {@link message}. */
function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/** The handle the {@link accountKey} account replies under; none while unknown. */
function ownHandle(context: CommandContext, accountKey: string | null): string {
  return accountByKey(context.state, accountKey)?.handle ?? '';
}

/** The create payload answering {@link target}'s post with {@link text}. */
function answerWith(context: CommandContext, target: StatusTarget, text: string): NewStatus {
  const draft = replyDraft(target.status, ownHandle(context, target.accountKey), text);
  return draftToNewStatus(draft, context.state.settings.defaultVisibility);
}

/** Hand {@link created} to the active window when it shows this account's stream. */
function addToActiveWindow(context: CommandContext, created: Status): void {
  const win = activeWindow(context.state.windows);
  if (!FEED_KINDS.has(win.ref.kind)) {
    return;
  }
  context.dispatch({
    type: 'statuses',
    windowId: win.id,
    statuses: [created],
    where: 'newer',
  });
}

/** Resolve the post, create the answer as its window's account, echo, report. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const { status, rest, session } = target.value;
  const text = rest.trim();
  if (text === '') {
    return fail(`Usage: ${USAGE}`);
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
  summary: 'Reply to a post in one line',
  run: async (args, context) => await handle(args, context),
  bindings: [{ mode: 'navigation', chord: 'r', args: '{label}', prefill: true }],
};
