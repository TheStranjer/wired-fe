/**
 * The status line just above the command line, like a WM bar: the clock, the
 * active account, one clickable entry per desktop with the unread of what it
 * shows, after a `│` the windows with unread that the active desktop does not
 * show (IRC-style activity), the count of media waiting for the next post
 * (WFE-126) when there is any, and the hotkey mode. Presentational only;
 * desktops, windows, media and time live in higher layers.
 */
import type { JSX } from 'react';

import styles from './StatusLine.module.css';
import { Desktops, HiddenWindows, PostingAs } from './StatusLineEntries';
import type { StatusLineDesktop, StatusLinePostingAs, StatusLineWindow } from './statusLineTypes';

/** Props of {@link StatusLine}. */
export type StatusLineProps = {
  /** Already formatted, e.g. "23:07". */
  readonly clock: string;
  /** The active account, e.g. "@lain@wired.example"; null when logged out. */
  readonly accountLabel: string | null;
  /** Who plain text posts as in a window with no account of its own, and how to change it; absent or null shows nothing (WFE-285). */
  readonly postingAs?: StatusLinePostingAs | null;
  /** The desktops, in number order. */
  readonly desktops: readonly StatusLineDesktop[];
  /** The hidden windows with activity, in window-number order. */
  readonly windows: readonly StatusLineWindow[];
  /** Which hotkey mode the keyboard is in (AGENTS.md "Two hotkey modes"). */
  readonly mode: 'insert' | 'navigation';
  /** Media waiting for the next post; absent or 0 shows no group (WFE-126). */
  readonly pendingMedia?: number;
  /** The prefix of a key sequence waiting for its next chord, e.g. "Ctrl+B"; null shows nothing. */
  readonly pendingKeys: string | null;
  /** The desk sync: `pending` while a push waits, `error` after a failure; absent or null shows nothing (decision 17). */
  readonly sync?: 'pending' | 'error' | null;
  /** Called with the desktop number when a desktop entry is clicked. */
  readonly onSelectDesktop: (number: number) => void;
  /** Called with the desktop number when its `×` is clicked or its entry middle-clicked. */
  readonly onCloseDesktop: (number: number) => void;
  /** Called with the window number when a window entry is clicked. */
  readonly onSelectWindow: (number: number) => void;
  /** Called when the waiting-media group is clicked: the app shows the tray's first description. */
  readonly onShowMedia: () => void;
};

/** What each mode is abbreviated to on the line. */
const MODE_LABEL: Record<StatusLineProps['mode'], string> = {
  insert: 'INS',
  navigation: 'NAV',
};

/** What the account group shows while logged out. */
const NO_ACCOUNT = '-';

/**
 * The pending-media group between the windows and the mode, or nothing
 * (WFE-126): a button that sends the reader to the tray's first description
 * (WFE-287).
 */
function PendingMedia(props: {
  readonly count: number;
  readonly onShow: () => void;
}): JSX.Element | null {
  if (props.count <= 0) {
    return null;
  }
  return (
    <>
      <button
        aria-label={`${String(props.count)} media waiting, show`}
        className={styles['media']}
        onClick={props.onShow}
        type="button"
      >
        {`[+${String(props.count)} media]`}
      </button>{' '}
    </>
  );
}

/** The pending key prefix beside the mode, e.g. `[Ctrl+B …]`, or nothing (decision 18). */
function PendingKeys(props: { readonly keys: string | null }): JSX.Element | null {
  if (props.keys === null) {
    return null;
  }
  const group = `[${props.keys} …]`;
  return (
    <>
      <span>{group}</span>{' '}
    </>
  );
}

/** What the sync marker shows and says, by state (decision 17). */
const SYNC_MARKERS: Record<'pending' | 'error', { readonly text: string; readonly name: string }> =
  {
    pending: { text: '⇅', name: 'Sync pending' },
    error: { text: '⇅!', name: 'Sync failed' },
  };

/** The sync marker before the mode: `⇅` while a push waits, `⇅!` after an error, nothing otherwise. */
function SyncGroup(props: { readonly marker: StatusLineProps['sync'] }): JSX.Element | null {
  const marker = props.marker ?? null;
  if (marker === null) {
    return null;
  }
  const { text, name } = SYNC_MARKERS[marker];
  return (
    <>
      <span role="img" aria-label={name}>
        {text}
      </span>{' '}
    </>
  );
}

/** One non-wrapping line naming the time, the account, the desktops, the hidden windows with activity, waiting media, pending keys, the sync and the mode. */
export function StatusLine(props: StatusLineProps): JSX.Element {
  const { clock, accountLabel, mode, pendingMedia = 0 } = props;

  return (
    <div className={styles['line']}>
      <span>{`[${clock}]`}</span> <span>{`[${accountLabel ?? NO_ACCOUNT}]`}</span>{' '}
      <PostingAs posting={props.postingAs ?? null} />
      <span>
        <Desktops
          desktops={props.desktops}
          onSelect={props.onSelectDesktop}
          onClose={props.onCloseDesktop}
        />
        <HiddenWindows windows={props.windows} onSelect={props.onSelectWindow} />
      </span>{' '}
      <PendingMedia count={pendingMedia} onShow={props.onShowMedia} />
      <PendingKeys keys={props.pendingKeys} />
      <SyncGroup marker={props.sync} />
      <span>{`[${MODE_LABEL[mode]}]`}</span>
    </div>
  );
}
