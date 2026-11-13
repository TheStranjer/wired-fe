/**
 * The status line just above the command line, irssi style: the clock, the
 * active account, one clickable entry per window with its unread count, and
 * the hotkey mode. Presentational only; windows and time live in higher layers.
 */
import { Fragment } from 'react';
import type { JSX } from 'react';

import styles from './StatusLine.module.css';

/** One window in the status line's window list. */
export type StatusLineWindow = {
  /** 1-based window number, what `Alt+N` and `/win N` use. */
  readonly number: number;
  /** Short name, e.g. "home" or "dm/bob". */
  readonly title: string;
  /** Items waiting in the window; 0 shows nothing extra. */
  readonly unread: number;
  /** True when a mention or DM is waiting. */
  readonly highlight: boolean;
  /** True for the window the user is looking at. */
  readonly active: boolean;
};

/** Props of {@link StatusLine}. */
export type StatusLineProps = {
  /** Already formatted, e.g. "23:07". */
  readonly clock: string;
  /** The active account, e.g. "@lain@wired.example"; null when logged out. */
  readonly accountLabel: string | null;
  /** The windows, in window-number order. */
  readonly windows: readonly StatusLineWindow[];
  /** Which hotkey mode the keyboard is in (AGENTS.md "Two hotkey modes"). */
  readonly mode: 'insert' | 'navigation';
  /** Called with the window number when an entry is clicked. */
  readonly onSelectWindow: (number: number) => void;
};

/** What each mode is abbreviated to on the line. */
const MODE_LABEL: Record<StatusLineProps['mode'], string> = {
  insert: 'INS',
  navigation: 'NAV',
};

/** What the account group shows while logged out. */
const NO_ACCOUNT = '-';

/** The visible text of one entry, e.g. "2:home(3)*". */
function entryText(entry: StatusLineWindow): string {
  const unread = entry.unread > 0 ? `(${String(entry.unread)})` : '';
  const marker = entry.highlight ? '*' : '';
  return `${String(entry.number)}:${entry.title}${unread}${marker}`;
}

/** The accessible name of one entry, e.g. "Window 2: home, 3 unread". */
function entryLabel(entry: StatusLineWindow): string {
  const parts = [`Window ${String(entry.number)}: ${entry.title}`];
  if (entry.unread > 0) {
    parts.push(`${String(entry.unread)} unread`);
  }
  if (entry.highlight) {
    parts.push('highlighted');
  }
  return parts.join(', ');
}

/**
 * The entry's classes: the plain-text button look plus every state it is in.
 * The stylesheet resolves colour by that order, so highlight beats unread
 * beats active, while an active entry keeps its bold weight whatever its colour.
 */
function entryClasses(entry: StatusLineWindow): string {
  return [
    styles['entry'],
    entry.active ? styles['active'] : undefined,
    entry.unread > 0 ? styles['unread'] : undefined,
    entry.highlight ? styles['highlighted'] : undefined,
  ].join(' ');
}

/** One non-wrapping line naming the time, the account, the windows and the mode. */
export function StatusLine(props: StatusLineProps): JSX.Element {
  const { clock, accountLabel, windows, mode, onSelectWindow } = props;

  return (
    <div className={styles['line']}>
      <span>{`[${clock}]`}</span> <span>{`[${accountLabel ?? NO_ACCOUNT}]`}</span>{' '}
      <span>
        {'['}
        {windows.map((entry, index) => (
          <Fragment key={entry.number}>
            {index === 0 ? '' : ' '}
            <button
              aria-current={entry.active ? 'true' : undefined}
              aria-label={entryLabel(entry)}
              className={entryClasses(entry)}
              onClick={() => {
                onSelectWindow(entry.number);
              }}
              type="button"
            >
              {entryText(entry)}
            </button>
          </Fragment>
        ))}
        {']'}
      </span>{' '}
      <span>{`[${MODE_LABEL[mode]}]`}</span>
    </div>
  );
}
