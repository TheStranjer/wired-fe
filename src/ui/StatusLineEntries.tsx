/**
 * The clickable parts of the status line: the desktop buttons `[2*:12]` and,
 * after a `│`, the hidden windows with activity `7:dm/bob(2)`. Presentational
 * only; what to list is decided by a higher layer.
 */
import { Fragment } from 'react';
import type { JSX } from 'react';

import styles from './StatusLine.module.css';
import { desktopLabel, windowLabel } from './statusLineLabels';
import type { StatusLineDesktop, StatusLinePostingAs, StatusLineWindow } from './statusLineTypes';
import { useT } from '../i18n/I18nProvider';

/** The visible text of one desktop, e.g. "[2*:12]". */
function desktopText(entry: StatusLineDesktop): string {
  const marker = entry.active ? '*' : '';
  const unread = entry.unread > 0 ? `:${String(entry.unread)}` : '';
  return `[${String(entry.number)}${marker}${unread}]`;
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

/**
 * The posting-account button, `→@handle` or `→?`, or nothing (WFE-285): a
 * click sends the reader to the account picker.
 */
export function PostingAs(props: {
  readonly posting: StatusLinePostingAs | null;
}): JSX.Element | null {
  const { posting } = props;
  const t = useT();
  if (posting === null) {
    return null;
  }
  const name = posting.label.startsWith('@')
    ? t('ui.status_line.posting_as', { label: posting.label })
    : t('ui.status_line.no_posting_account');
  return (
    <>
      <button
        aria-label={name}
        className={styles['posting']}
        onClick={() => {
          posting.onPick();
        }}
        type="button"
      >
        {`→${posting.label}`}
      </button>{' '}
    </>
  );
}

/** The `×` after the active desktop's marker: closes that desktop. */
function CloseDesktop(props: {
  readonly number: number;
  readonly onClose: (number: number) => void;
}): JSX.Element {
  const t = useT();
  return (
    <button
      aria-label={t('ui.status_line.close_desktop', { number: props.number })}
      className={styles['closeDesktop']}
      onClick={() => {
        props.onClose(props.number);
      }}
      type="button"
    >
      ×
    </button>
  );
}

/**
 * The desktop buttons, one `[N]` each; the active one is marked and inverted
 * and, while there is more than one desktop, followed by a `×` that closes it.
 * A middle-click on any marker closes that desktop.
 */
export function Desktops(props: {
  readonly desktops: readonly StatusLineDesktop[];
  readonly onSelect: (number: number) => void;
  readonly onClose: (number: number) => void;
}): JSX.Element {
  const t = useT();
  return (
    <>
      {props.desktops.map((entry, index) => (
        <Fragment key={entry.number}>
          {index === 0 ? '' : ' '}
          <button
            aria-current={entry.active ? 'true' : undefined}
            aria-label={desktopLabel(t, entry)}
            className={desktopClasses(entry)}
            onAuxClick={(event) => {
              if (event.button === 1) {
                props.onClose(entry.number);
              }
            }}
            onClick={() => {
              props.onSelect(entry.number);
            }}
            title={t('ui.status_line.desktop_title', { number: entry.number })}
            type="button"
          >
            {desktopText(entry)}
          </button>
          {entry.active && props.desktops.length > 1 ? (
            <CloseDesktop number={entry.number} onClose={props.onClose} />
          ) : null}
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
  const t = useT();
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
            aria-label={windowLabel(t, entry)}
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
