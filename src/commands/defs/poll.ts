/**
 * `/poll "<question>" "<option>" "<option>" [...] [--multiple] [--hours N]`
 * (decision 6): post through the active window with a poll attached. The
 * argument text is read with {@link tokenize}, so the question and every
 * option may carry spaces inside quotes. The first token is the question; the
 * tokens after it are the options, except the flags pulled out from between
 * them: `--multiple` lets a ballot pick more than one option, and `--hours N`
 * runs the poll for N hours — a positive number — instead of the default 24.
 * A broken quote, a missing or empty question, a bad `--hours` value and an
 * unknown flag each echo the usage. The finished plan is checked against the
 * acting account's `pollLimits` (decision 5): the option count, every option's
 * length and the run's span each refuse by name. What passes goes to
 * {@link CommandContext.post} as a draft carrying a poll; the error string the
 * window's post handler answers with comes back as the command's failure, and
 * success prints `poll posted`.
 */

import type { PollLimits } from '../../api/schemas/pollLimits';
import { formatDuration } from '../../lib/duration';
import { type Result, err, ok } from '../../lib/result';
import { capabilitiesFor } from '../../state/selectors';
import { fail } from '../outcome';
import { tokenize } from '../tokenize';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** How to call the command, echoed by every grammar refusal. */
const USAGE = '/poll "<question>" "<option>" "<option>" [...] [--multiple] [--hours N]';

/** Shown when there is no acting account whose instance limits can be read. */
const NOT_CONNECTED: CommandOutcome = {
  ok: false,
  message: 'Not connected. Type /connect',
};

/** Fewer options than this is not much of a poll. */
const MIN_OPTIONS = 2;

/** The poll runs this many hours unless `--hours` says otherwise. */
const DEFAULT_HOURS = 24;

/** The hours `--hours` counts, in the seconds the API counts in. */
const SECONDS_PER_HOUR = 3600;

/** The flag that lets a ballot pick more than one option. */
const MULTIPLE_FLAG = '--multiple';

/** The flag that names the poll's run in hours. */
const HOURS_FLAG = '--hours';

/** The draft was left for the active window's post handler. */
const OK: CommandOutcome = { ok: true };

/** The settled poll: the post text, its options, the run and its kind. */
type PollPlan = {
  readonly question: string;
  readonly options: readonly string[];
  readonly expiresIn: number;
  readonly multiple: boolean;
};

/** What the walk of the tokens after the question settled: options and flags. */
type Picked = {
  readonly options: string[];
  readonly multiple: boolean;
  readonly hours: number | null;
};

/** Whether {@link token} names a flag rather than a poll option. */
function isFlag(token: string): boolean {
  return token.startsWith('--');
}

/** The word behind `--hours` as a positive number of hours; null for anything else. */
function parseHours(raw: string | undefined): number | null {
  const hours = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

/** The option words {@link rest} holds, with `--multiple` and `--hours` pulled out. */
function pickArgs(rest: readonly string[]): Result<Picked, string> {
  const options: string[] = [];
  let multiple = false;
  let hours: number | null = null;
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i] ?? '';
    if (token === MULTIPLE_FLAG) {
      multiple = true;
    } else if (token === HOURS_FLAG) {
      const value = parseHours(rest[i + 1]);
      if (value === null) {
        return err(`${HOURS_FLAG} wants a positive number of hours`);
      }
      hours = value;
      i += 1;
    } else if (isFlag(token)) {
      return err(`Unknown flag: ${token}`);
    } else {
      options.push(token);
    }
  }
  return ok({ options, multiple, hours });
}

/**
 * The argument text as a {@link PollPlan}: tokenized, split into the question,
 * the options and the flags, the run settled in seconds. An unterminated
 * quote, no argument text, and a missing or empty question each refuse with
 * the usage; the flags refuse with what they want instead.
 */
function planPoll(args: string): Result<PollPlan, string> {
  const tokenized = tokenize(args);
  const [question, ...rest] = tokenized.ok ? tokenized.value : [];
  if (question === undefined || question === '') {
    return err(`Usage: ${USAGE}`);
  }
  const picked = pickArgs(rest);
  if (!picked.ok) {
    return picked;
  }
  const { options, multiple, hours } = picked.value;
  return ok({
    question,
    options,
    expiresIn: (hours ?? DEFAULT_HOURS) * SECONDS_PER_HOUR,
    multiple,
  });
}

/** Why {@link plan} does not fit {@link limits}; null when it fits. */
function checkPoll(plan: PollPlan, limits: PollLimits): string | null {
  if (plan.options.length < MIN_OPTIONS || plan.options.length > limits.maxOptions) {
    return `A poll needs ${String(MIN_OPTIONS)}–${String(limits.maxOptions)} options`;
  }
  const long = plan.options.find((option) => option.length > limits.maxCharactersPerOption);
  if (long !== undefined) {
    return `Option "${long}" is longer than ${String(limits.maxCharactersPerOption)} characters`;
  }
  if (plan.expiresIn < limits.minExpiration || plan.expiresIn > limits.maxExpiration) {
    const span = `${formatDuration(limits.minExpiration)} and ${formatDuration(limits.maxExpiration)}`;
    return `Poll must run between ${span}`;
  }
  return null;
}

/** Plan the poll, fit it to the acting account's limits, and post it. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const plan = planPoll(args);
  if (!plan.ok) {
    return fail(plan.error);
  }
  const capabilities = capabilitiesFor(context.state, context.state.activeAccountKey);
  if (capabilities === null) {
    return NOT_CONNECTED;
  }
  const problem = checkPoll(plan.value, capabilities.pollLimits);
  if (problem !== null) {
    return fail(problem);
  }
  const { question, options, expiresIn, multiple } = plan.value;
  const error = await context.post({ text: question, poll: { options, expiresIn, multiple } });
  if (error !== null) {
    return fail(error);
  }
  context.print('poll posted');
  return OK;
}

/** The `/poll` definition. */
export const command: CommandDefinition = {
  name: 'poll',
  usage: USAGE,
  summary: 'Post a poll to the active window',
  run: handle,
};
