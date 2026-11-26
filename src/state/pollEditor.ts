/**
 * The composer's poll editor as pure state (WFE-206): the poll a composer
 * edits is the very {@link Draft} poll `/poll` posts, so what the editor
 * builds goes out through the same create. This module holds what the editor
 * needs around it — the durations an instance allows, a fresh poll, the
 * add/remove/edit transitions, how a poll is fitted to another instance's
 * limits, and what is wrong with each option — so the form only draws it.
 */

import type { Draft } from './draft';
import type { PollLimits } from '../api/schemas/pollLimits';
import { t } from '../i18n/translate';
import { formatDuration } from '../lib/duration';

/** The poll a composer edits: options as typed, the run in seconds, and the two switches. */
export type DraftPoll = NonNullable<Draft['poll']>;

/** One duration the select offers. */
type DurationChoice = { readonly seconds: number; readonly label: string };

/** A poll needs at least this many options. */
export const MIN_POLL_OPTIONS = 2;

/** A preset: its run and the unit message that words it for {@link count} of that unit. */
type Preset = {
  readonly seconds: number;
  readonly unit: 'state.duration_minutes' | 'state.duration_hours' | 'state.duration_days';
  readonly count: number;
};

/** The durations the select offers, before the instance's limits cut them. */
const DURATION_PRESETS: readonly Preset[] = [
  { seconds: 300, unit: 'state.duration_minutes', count: 5 },
  { seconds: 1800, unit: 'state.duration_minutes', count: 30 },
  { seconds: 3600, unit: 'state.duration_hours', count: 1 },
  { seconds: 21_600, unit: 'state.duration_hours', count: 6 },
  { seconds: 86_400, unit: 'state.duration_days', count: 1 },
  { seconds: 259_200, unit: 'state.duration_days', count: 3 },
  { seconds: 604_800, unit: 'state.duration_days', count: 7 },
];

/** The run a new poll starts with: a day, or the allowed one nearest to it. */
const DEFAULT_EXPIRES_IN = 86_400;

/**
 * The presets within {@link limits}; an instance whose range holds none of
 * them gets its shortest allowed run, so the select is never empty.
 */
export function durationChoices(limits: PollLimits): readonly DurationChoice[] {
  const fitting = DURATION_PRESETS.filter(
    ({ seconds }) => seconds >= limits.minExpiration && seconds <= limits.maxExpiration,
  ).map(({ seconds, unit, count }) => ({ seconds, label: t(unit, { count }) }));
  return fitting.length > 0
    ? fitting
    : [{ seconds: limits.minExpiration, label: formatDuration(limits.minExpiration) }];
}

/** The choice nearest to {@link seconds}; {@link choices} is never empty. */
function nearest(seconds: number, choices: readonly DurationChoice[]): number {
  return choices
    .map((choice) => choice.seconds)
    .reduce((best, next) => (Math.abs(next - seconds) < Math.abs(best - seconds) ? next : best));
}

/** A fresh poll for an instance with {@link limits}: two empty options, a day, single choice. */
export function newPoll(limits: PollLimits): DraftPoll {
  return {
    options: ['', ''],
    expiresIn: nearest(DEFAULT_EXPIRES_IN, durationChoices(limits)),
    multiple: false,
    hideTotals: false,
  };
}

/**
 * {@link poll} fitted to another instance's {@link limits}: options past its
 * maximum are dropped from the end and the run moves to the nearest one it allows.
 */
export function fitPoll(poll: DraftPoll, limits: PollLimits): DraftPoll {
  return {
    ...poll,
    options: poll.options.slice(0, Math.max(MIN_POLL_OPTIONS, limits.maxOptions)),
    expiresIn: nearest(poll.expiresIn, durationChoices(limits)),
  };
}

/** {@link poll} with option {@link index} reading {@link text}. */
export function setOption(poll: DraftPoll, index: number, text: string): DraftPoll {
  return { ...poll, options: poll.options.map((was, at) => (at === index ? text : was)) };
}

/** {@link poll} with one more empty option. */
export function addOption(poll: DraftPoll): DraftPoll {
  return { ...poll, options: [...poll.options, ''] };
}

/** {@link poll} without option {@link index}. */
export function removeOption(poll: DraftPoll, index: number): DraftPoll {
  return { ...poll, options: poll.options.filter((_, at) => at !== index) };
}

/** One option as typed, with what is wrong with it. */
type CheckedOption = { readonly text: string; readonly problem: string | null };

/** What is wrong with {@link text}, option number {@link index} of the poll {@link whole}; null if nothing. */
function optionProblem(
  text: string,
  index: number,
  whole: { readonly options: readonly string[]; readonly limits: PollLimits },
): string | null {
  const { options, limits } = whole;
  const n = String(index + 1);
  if (text.trim() === '') {
    return t('state.poll_option_empty', { n });
  }
  if (text.length > limits.maxCharactersPerOption) {
    return t('state.poll_option_too_long', { n, max: limits.maxCharactersPerOption });
  }
  const key = text.trim().toLowerCase();
  const first = options.findIndex((other) => other.trim().toLowerCase() === key);
  return first === index ? null : t('state.poll_option_repeats', { n, first: String(first + 1) });
}

/** Each of {@link poll}'s options, in order, with what is wrong with it under {@link limits}. */
export function checkOptions(poll: DraftPoll, limits: PollLimits): readonly CheckedOption[] {
  return poll.options.map((text, index) => ({
    text,
    problem: optionProblem(text, index, { options: poll.options, limits }),
  }));
}

/** Whether every option of {@link poll} is fine under {@link limits}. */
export function pollIsValid(poll: DraftPoll, limits: PollLimits): boolean {
  return checkOptions(poll, limits).every(({ problem }) => problem === null);
}

/**
 * Whether the poll keeps the draft from being sent: it is open with an option
 * that is wrong, or the draft also carries media ({@link mediaCount}), which no
 * post may do alongside a poll.
 */
export function pollBlocksSend(
  poll: DraftPoll | undefined,
  mediaCount: number,
  limits: PollLimits,
): boolean {
  return poll !== undefined && (mediaCount > 0 || !pollIsValid(poll, limits));
}
