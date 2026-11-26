/**
 * A poll on a post, drawn under its body as monospace lines (WFE-98): one row
 * per option — `[1] yes  ██████░░░░░░░░░░░░░░  30%  ✓` — with the option's
 * share as a 20-cell ASCII bar, its rounded percentage, and a check mark on
 * the options this account voted for; below them one footer tallying the
 * votes, the closing time and the `/vote <label> <n>` command that still
 * works. Purely presentational (AGENTS.md "Layout"): api's Poll reaches it
 * through views/postView as plain {@link PollViewData}, never as an API type,
 * and voting itself stays with the command line.
 */
import type { JSX } from 'react';

import styles from './PollView.module.css';
import { formatClock, formatPercent } from '../i18n/format';
import { useLocale, useT } from '../i18n/I18nProvider';
import { bar } from '../lib/bars';
import type { ClockFormat } from '../lib/time';

/** What a poll shows: the ui twin of api's Poll (AGENTS.md "Layout"), minus
 * the ids and emojis the row does not draw, in the names the row uses. */
export type PollViewData = {
  readonly options: readonly { readonly title: string; readonly votes: number | null }[];
  readonly totalVotes: number;
  readonly expiresAt: Date | null;
  readonly expired: boolean;
  readonly multiple: boolean;
  /** The options this account voted for, as 0-based indexes. */
  readonly ownVotes: readonly number[];
  readonly voted: boolean;
};

/** Props of {@link PollView}: the poll, the label of the row whose `/vote`
 * hint names it, and how its clock is rendered. */
type PollViewProps = {
  readonly poll: PollViewData;
  readonly label: string;
  readonly clockFormat: ClockFormat;
};

/** What the poll's text needs to speak the language in use: its words, its figures and its clock. */
type Speech = {
  readonly t: ReturnType<typeof useT>;
  readonly locale: string;
  readonly clockFormat: ClockFormat;
};

/** The bar of every option, in cells. */
const BAR_WIDTH = 20;

/** The percentage column, so `%` sits in one line under `%`. */
const PERCENT_WIDTH = 3;

/** The option the footer hint suggests first. */
const HINT_OPTION = 1;

/** The word between the footer's pieces. */
const SEPARATOR = ' · ';

/** What an option's tally column says where the backend hides the tally. */
const HIDDEN = '?';

/** One option as the row names it. */
type Option = PollViewData['options'][number];

/** One finished option line: what to print, and whether the viewer's mark sits on it. */
type OptionLine = {
  readonly key: string;
  readonly text: string;
  readonly own: boolean;
};

/** An option's share of the votes: nothing when it is hidden or nobody voted. */
function shareOf(option: Option, totalVotes: number): number {
  return option.votes === null || totalVotes === 0 ? 0 : option.votes / totalVotes;
}

/** The option's rounded percentage, or `?` where the backend hides its tally. */
function percentOf(option: Option, totalVotes: number, locale: string): string {
  if (option.votes === null) {
    return HIDDEN;
  }
  return formatPercent(locale, Math.round(shareOf(option, totalVotes) * 100) / 100);
}

/** Every option as one line: `[n] title  bar  pct`, titles padded to the longest. */
function linesOf(poll: PollViewData, locale: string): readonly OptionLine[] {
  const longest = poll.options.reduce((wide, option) => Math.max(wide, option.title.length), 0);
  return poll.options.map((option, index) => ({
    key: `option-${String(index + 1)}`,
    own: poll.ownVotes.includes(index),
    text: `[${String(index + 1)}] ${option.title.padEnd(longest)}  ${bar(shareOf(option, poll.totalVotes), BAR_WIDTH)}  ${percentOf(option, poll.totalVotes, locale).padStart(PERCENT_WIDTH)}`,
  }));
}

/** When the poll closes: its clock while it is open, `closed` once it is not,
 * and nothing at all when the backend never named a deadline. */
function closeText(poll: PollViewData, speech: Speech): string | null {
  const { t, locale, clockFormat } = speech;
  if (poll.expired) {
    return t('format.closed');
  }
  const time = poll.expiresAt === null ? null : formatClock(locale, poll.expiresAt, clockFormat);
  return time === null ? null : t('format.closes', { time });
}

/** The command that still votes on this poll, or nothing when it cannot. */
function voteHint(poll: PollViewData, label: string): string | null {
  return poll.expired || poll.voted ? null : `/vote ${label} ${String(HINT_OPTION)}`;
}

/** The footer line: the tally, the deadline, the hint and the kind of poll. */
function footerText(poll: PollViewData, label: string, speech: Speech): string {
  const votes = speech.t('format.vote_count', { count: poll.totalVotes });
  const parts = [votes, closeText(poll, speech), voteHint(poll, label)];
  if (poll.multiple) {
    parts.push(speech.t('format.multiple_choice'));
  }
  return parts.filter((part) => part !== null).join(SEPARATOR);
}

/** The poll of one post: its option lines and the footer below them. */
export function PollView(props: PollViewProps): JSX.Element {
  const { poll, label, clockFormat } = props;
  const locale = useLocale();
  const t = useT();
  const speech = { t, locale, clockFormat };
  return (
    <div className={styles['poll']}>
      {linesOf(poll, locale).map((line) => (
        <div key={line.key}>
          {line.text}
          {line.own ? (
            <span className={styles['own']} title="you voted for this">
              {'  ✓'}
            </span>
          ) : undefined}
        </div>
      ))}
      <div className={styles['footer']}>{footerText(poll, label, speech)}</div>
    </div>
  );
}
