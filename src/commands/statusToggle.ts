/**
 * The body the eight post toggles share (decision 6): `/fav`, `/boost`,
 * `/bookmark` and `/pin` move one flag of a post, and each has an `un…`
 * command that always takes that flag back. The post resolves the way the
 * other post commands resolve theirs — a leading label or the navigation
 * selection, a boost resolving to its original — and the flag the status
 * carries decides which way a bare toggle goes. One
 * `POST /api/v1/statuses/<id>/<action>` follows; the status the instance
 * answers replaces the post in every scrollback, and a boost answers with the
 * wrapper it made, so the original inside it is what travels. The window
 * prints the toggle's mark, its verb and the label of the line the post was
 * seen on; a refusal or a failed call comes back as the message instead, with
 * nothing sent. Pinning belongs to the author alone: `/pin` and `/unpin` both
 * refuse a post of anybody else before the request leaves.
 */

import { targetLabel } from './statusLabel';
import { type StatusTarget, resolveStatusTarget } from './targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from './types';
import { type StatusAction, statusAction } from '../api/endpoints/statusActions';
import { describeApiError } from '../api/errors';
import type { ApiSession } from '../api/session';
import { type Result, err, ok } from '../lib/result';
import { accountByKey } from '../state/selectors';

/** The four flags of a post a toggle moves. */
type ToggleFeature = 'fav' | 'boost' | 'bookmark' | 'pin';

/** Every toggle command: the four features and the four `un…` commands undoing them. */
export type ToggleCommand = ToggleFeature | `un${ToggleFeature}`;

/** Which flag of a status says where a toggle stands. */
type ToggleField = 'favourited' | 'reblogged' | 'bookmarked' | 'pinned';

/** One feature's two endpoints, its printed mark and verb, and who may move it. */
type Toggle = {
  readonly field: ToggleField;
  readonly on: StatusAction;
  readonly off: StatusAction;
  readonly mark: string;
  readonly verb: string;
  readonly ownOnly: boolean;
};

/** The command's feature and whether it only ever takes the flag back. */
type Route = {
  readonly feature: ToggleFeature;
  readonly undo: boolean;
};

/** One toggle settled: what to send for which post, and what to print. */
type Move = {
  readonly action: StatusAction;
  readonly mark: string;
  readonly word: string;
  readonly label: string;
  readonly session: ApiSession;
  readonly id: string;
};

/** The four toggles, under the names their commands are named for. */
const TOGGLES: Record<ToggleFeature, Toggle> = {
  fav: {
    field: 'favourited',
    on: 'favourite',
    off: 'unfavourite',
    mark: '★',
    verb: 'favourited',
    ownOnly: false,
  },
  boost: {
    field: 'reblogged',
    on: 'reblog',
    off: 'unreblog',
    mark: '⟳',
    verb: 'boosted',
    ownOnly: false,
  },
  bookmark: {
    field: 'bookmarked',
    on: 'bookmark',
    off: 'unbookmark',
    mark: '🔖',
    verb: 'bookmarked',
    ownOnly: false,
  },
  pin: {
    field: 'pinned',
    on: 'pin',
    off: 'unpin',
    mark: '📌',
    verb: 'pinned',
    ownOnly: true,
  },
};

/** All eight commands: the toggle each moves, and the way it always takes it. */
const COMMANDS: Record<ToggleCommand, Route> = {
  fav: { feature: 'fav', undo: false },
  unfav: { feature: 'fav', undo: true },
  boost: { feature: 'boost', undo: false },
  unboost: { feature: 'boost', undo: true },
  bookmark: { feature: 'bookmark', undo: false },
  unbookmark: { feature: 'bookmark', undo: true },
  pin: { feature: 'pin', undo: false },
  unpin: { feature: 'pin', undo: true },
};

/** The toggle moved and the window printed it. */
const OK: CommandOutcome = { ok: true };

/** What a pin command answers when the post is not the acting account's own. */
const NOT_MINE = 'You can only pin your own posts';

/** A failure naming {@link message}. */
function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/**
 * Why {@link toggle} may not move on {@link target}'s post, or null when it
 * may: a toggle only its author moves needs the window's account to be the
 * post's author — an accountless window never is.
 */
function ownershipProblem(
  toggle: Toggle,
  target: StatusTarget,
  context: CommandContext,
): string | null {
  if (!toggle.ownOnly) {
    return null;
  }
  const account = accountByKey(context.state, target.accountKey);
  return account !== null && account.accountId === target.status.account.id ? null : NOT_MINE;
}

/**
 * The move {@link command} makes on {@link target}: an `un…` command always
 * takes the flag off, a bare toggle takes it off when the status carries it
 * and puts it on when it does not.
 */
function prepare(
  command: ToggleCommand,
  target: StatusTarget,
  context: CommandContext,
): Result<Move, string> {
  const { feature, undo } = COMMANDS[command];
  const toggle = TOGGLES[feature];
  const problem = ownershipProblem(toggle, target, context);
  if (problem !== null) {
    return err(problem);
  }
  const on = !undo && !target.status[toggle.field];
  return ok({
    action: on ? toggle.on : toggle.off,
    mark: toggle.mark,
    word: on ? toggle.verb : `un${toggle.verb}`,
    label: targetLabel(context, target.status),
    session: target.session,
    id: target.status.id,
  });
}

/**
 * Send {@link move} and share what the instance answered with every
 * scrollback — for a boost that answer is the wrapper, so the original inside
 * it is the status that replaces the post.
 */
async function apply(move: Move, context: CommandContext): Promise<CommandOutcome> {
  const answered = await statusAction(move.session, move.id, move.action);
  if (!answered.ok) {
    return fail(describeApiError(answered.error));
  }
  context.dispatch({ type: 'statusUpdated', status: answered.value.reblog ?? answered.value });
  context.print(`${move.mark} ${move.word} ${move.label}`);
  return OK;
}

/**
 * Run one post toggle over {@link args} as {@link command}: resolve the post,
 * settle which way its flag moves and whether this account may move it, send
 * it, and print what became of it.
 */
export async function runStatusToggle(
  args: string,
  context: CommandContext,
  command: ToggleCommand,
): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const move = prepare(command, target.value, context);
  return move.ok ? await apply(move.value, context) : fail(move.error);
}

/** {@link runStatusToggle} for {@link command}, in the shape a definition's run wants. */
export function toggleRun(command: ToggleCommand): CommandDefinition['run'] {
  return async (args, context) => await runStatusToggle(args, context, command);
}
