/**
 * `/vote` (decision 6): cast this account's ballot on the poll of a post. The
 * target resolves the way the other post commands resolve theirs (decision 6):
 * a leading label names a post of the active window's scrollback, otherwise the
 * navigation selection stands, and a boost votes on the poll of its original —
 * so the `[a3]` the messages print is the label of the line the window shows,
 * the very one `PollView`'s footer hint names. The post must carry a poll, the
 * poll must be open, and this account must not have voted yet. The choices are
 * the options' one-based numbers, without repeats, and one of them only unless
 * the poll is multiple. The ballot leaves for `votePoll` as zero-based indexes;
 * the poll the instance answers replaces the status in every scrollback.
 */

import { votePoll } from '../../api/endpoints/polls';
import { describeApiError } from '../../api/errors';
import type { Poll } from '../../api/schemas/poll';
import type { Status } from '../../api/schemas/status';
import type { ApiSession } from '../../api/session';
import { type Result, err, ok } from '../../lib/result';
import { type StatusTarget, resolveStatusTarget, targetLabel } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The ballot is cast and every scrollback knows the new tally. */
const OK: CommandOutcome = { ok: true };

/** One choice as typed: the option's one-based number, digits only. */
const CHOICE = /^[0-9]+$/u;

/** The trimmed {@link text} split at whitespace; none is the empty list. */
function words(text: string): readonly string[] {
  const trimmed = text.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/u);
}

/** The word as a zero-based option index; NaN when it is no plain number. */
function indexOf(word: string): number {
  return CHOICE.test(word) ? Number(word) - 1 : Number.NaN;
}

/** The poll a ballot may still land on; absent, closed and voted each refuse. */
function openPoll(status: Status, label: string): Result<Poll, string> {
  const { poll } = status;
  if (poll === null) {
    return err(`No poll on ${label}`);
  }
  if (poll.expired) {
    return err('That poll is closed');
  }
  return poll.voted ? err('You already voted') : ok(poll);
}

/**
 * The typed words as zero-based option indexes: every one a one-based number
 * the poll's options reach, no word twice, one choice only on a single-choice
 * poll, and at least one either way.
 */
function parseChoices(typed: readonly string[], poll: Poll): Result<number[], string> {
  const last = poll.options.length;
  const indexes = typed.map(indexOf);
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= last)) {
    return err(`Options are 1–${String(last)}`);
  }
  const repeated = new Set(indexes).size !== indexes.length;
  const tooMany = indexes.length > 1 && !poll.multiple;
  if (repeated || tooMany || indexes.length === 0) {
    return err(`Pick one option (1–${String(last)})`);
  }
  return ok(indexes);
}

/** A zero-based option index as the command names it back: one-based. */
function typedChoice(index: number): string {
  return String(index + 1);
}

/** The settled ballot: the post, the connection, the poll and its choices. */
type Ballot = {
  readonly status: Status;
  readonly session: ApiSession;
  readonly poll: Poll;
  readonly choices: readonly number[];
  readonly label: string;
};

/** Guard the poll and the choices of a resolved target, and settle the ballot. */
function prepare(target: StatusTarget, context: CommandContext): Result<Ballot, string> {
  const { status, rest, session } = target;
  const label = targetLabel(context, status);
  const poll = openPoll(status, label);
  if (!poll.ok) {
    return poll;
  }
  const choices = parseChoices(words(rest), poll.value);
  return choices.ok
    ? ok({ status, session, poll: poll.value, choices: choices.value, label })
    : choices;
}

/** Cast {@link ballot}; the answered poll replaces the status in every scrollback. */
async function cast(context: CommandContext, ballot: Ballot): Promise<CommandOutcome> {
  const voted = await votePoll(ballot.session, ballot.poll.id, ballot.choices);
  if (!voted.ok) {
    return { ok: false, message: describeApiError(voted.error) };
  }
  context.dispatch({ type: 'statusUpdated', status: { ...ballot.status, poll: voted.value } });
  context.print(`voted ${ballot.choices.map(typedChoice).join(' ')} on ${ballot.label}`);
  return OK;
}

/** Resolve the post and its ballot, then cast it; any refusal comes back instead. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return { ok: false, message: target.error };
  }
  const ballot = prepare(target.value, context);
  return ballot.ok ? await cast(context, ballot.value) : { ok: false, message: ballot.error };
}

/** The `/vote` definition. */
export const command: CommandDefinition = {
  name: 'vote',
  aliases: [],
  usage: '/vote [label] <n> [n…]',
  summary: 'Vote on the poll of a post',
  run: async (args, context) => await handle(args, context),
};
