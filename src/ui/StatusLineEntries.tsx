/**
 * The clickable parts of the status line: the desktop buttons `[2*:12]` and,
 * after a `│`, the hidden windows with activity `7:dm/bob(2)`. Presentational
 * only; what to list is decided by a higher layer.
 */
import { Fragment } from 'react';
import type { JSX } from 'react';

import styles from './StatusLine.module.css';
import type { StatusLineDesktop, StatusLineWindow } from './statusLineTypes';

/** The visible text of one desktop, e.g. "[2*:12]". */
function desktopText(entry: StatusLineDesktop): string {
  const marker = entry.active ? '*' : '';
  const unread = entry.unread > 0 ? `:${String(entry.unread)}` : '';
  return `[${String(entry.number)}${marker}${unread}]`;
}

/** The accessible name of one desktop, e.g. "Desktop 2, active, 12 unread". */
function desktopLabel(entry: StatusLineDesktop): string {
  const parts = [`Desktop ${String(entry.number)}`];
  if (entry.active) {
    parts.push('active');
  }
  if (entry.unread > 0) {
    parts.push(`${String(entry.unread)} unread`);
  }
  if (entry.highlight) {
    parts.push('highlighted');
  }
  return parts.join(', ');
}

/**
 * The classes of an entry with `unread` and `highlight` state: the plain-text
 * button look plus every state it is in. The stylesheet resolves colour by
 * that order, so highlight beats unread.
 */
function stateClasses(entry: {
  readonly unread: number;
  readonly highlight: boolean;
}): (string | undefined)[] {
  return [
    styles['entry'],
    entry.unread > 0 ? styles['unread'] : undefined,
    entry.highlight ? styles['highlighted'] : undefined,
  ];
}

/** The desktop's classes: the state classes, plus the inverted look when it is on screen. */
function desktopClasses(entry: StatusLineDesktop): string {
  return [...stateClasses(entry), entry.active ? styles['activeDesktop'] : undefined].join(' ');
}

/** The visible text of one window entry, e.g. "7:dm/bob(2)*". */
function windowText(entry: StatusLineWindow): string {
  const unread = entry.unread > 0 ? `(${String(entry.unread)})` : '';
  const marker = entry.highlight ? '*' : '';
  return `${String(entry.number)}:${entry.title}${unread}${marker}`;
}

/** The accessible name of one window entry, e.g. "Window 7: dm/bob, 2 unread". */
function windowLabel(entry: StatusLineWindow): string {
  const parts = [`Window ${String(entry.number)}: ${entry.title}`];
  if (entry.unread > 0) {
    parts.push(`${String(entry.unread)} unread`);
  }
  if (entry.highlight) {
    parts.push('highlighted');
  }
  return parts.join(', ');
}

/** The desktop buttons, one `[N]` each; the active one is marked and inverted. */
export function Desktops(props: {
  readonly desktops: readonly StatusLineDesktop[];
  readonly onSelect: (number: number) => void;
}): JSX.Element {
  return (
    <>
      {props.desktops.map((entry, index) => (
        <Fragment key={entry.number}>
          {index === 0 ? '' : ' '}
          <button
            aria-current={entry.active ? 'true' : undefined}
            aria-label={desktopLabel(entry)}
            className={desktopClasses(entry)}
            onClick={() => {
              props.onSelect(entry.number);
            }}
            type="button"
          >
            {desktopText(entry)}
          </button>
        </Fragment>
      ))}
    </>
  );
}

/** The hidden windows with activity after a `│`, or nothing when there are none. */
export function HiddenWindows(props: {
  readonly windows: readonly StatusLineWindow[];
  readonly onSelect: (number: number) => void;
}): JSX.Element | null {
  if (props.windows.length === 0) {
    return null;
  }
  return (
    <>
      {' │ '}
      {props.windows.map((entry, index) => (
        <Fragment key={entry.number}>
          {index === 0 ? '' : ' '}
          <button
            aria-label={windowLabel(entry)}
            className={stateClasses(entry).join(' ')}
            onClick={() => {
              props.onSelect(entry.number);
            }}
            type="button"
          >
            {windowText(entry)}
          </button>
        </Fragment>
      ))}
    </>
  );
}
