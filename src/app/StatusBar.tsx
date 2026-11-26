/**
 * The status line wired to real state (AGENTS.md "Windows, like IRC
 * buffers"): the clock, the active account, the desktops and the hidden
 * windows with activity (./statusEntries), the pending media and the hotkey
 * mode. A click on a desktop runs what `/desktop N` runs, the `×` after
 * the active one (or a middle-click on any) what `/desktop close N` runs, and a
 * click on a window what `/win N` runs (decision 6). The header and pane titles show an
 * account the same way, through {@link accountLabel}.
 */

import type { JSX } from 'react';

import { statusEntries } from './statusEntries';
import type { Attachments } from './useAttachments';
import { useClock } from './useClock';
import type { AppState } from '../state/appState';
import { postingAccount } from '../state/postingAccount';
import { accountByKey } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';
import { StatusLine } from '../ui/StatusLine';
import type { StatusLinePostingAs } from '../ui/statusLineTypes';
import { activeWindow } from '../windows/model';

/** The account behind {@link key}, named the way the bars show it; null if none. */
export function accountLabel(state: AppState, key: string | null): string | null {
  const account = accountByKey(state, key);
  return account === null ? null : `@${account.handle}`;
}

/** What the status line's sync marker shows: the error beats a waiting push; nothing when idle (decision 17). */
function syncMarker(sync: AppState['sync']): 'pending' | 'error' | null {
  if (sync.failed) {
    return 'error';
  }
  return sync.pending ? 'pending' : null;
}

/**
 * The posting-account entry (WFE-285): who plain text posts as in the focused
 * window, shown only where the window has no account of its own, with a click
 * that opens the picker (what `/postas` runs).
 */
function postingEntry(state: AppState, dispatch: Dispatch): StatusLinePostingAs | null {
  const win = activeWindow(state.windows);
  if (win.ref.accountKey !== null) {
    return null;
  }
  const posting = postingAccount(state, win);
  return {
    label: posting === null ? '?' : `@${posting.account.handle}`,
    onPick: () => {
      dispatch({ type: 'openAccountPick', pick: { purpose: 'default', windowId: win.id } });
    },
  };
}

/** The status line: clock, active account, desktops, hidden windows with activity, pending media, pending keys, sync marker and hotkey mode. */
export function StatusBar(props: {
  /** The pending media: how many are ready, and the way `[+N media]` shows the tray's first description. */
  readonly attachments: Pick<Attachments, 'pending' | 'showMedia'>;
  readonly pendingKeys: string | null;
}): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const clock = useClock(state.settings.clockFormat);
  const entries = statusEntries(state.layout, state.windows);
  return (
    <StatusLine
      clock={clock}
      accountLabel={accountLabel(state, state.activeAccountKey)}
      postingAs={postingEntry(state, dispatch)}
      desktops={entries.desktops}
      windows={entries.windows}
      mode={state.mode}
      pendingMedia={props.attachments.pending.length}
      pendingKeys={props.pendingKeys}
      onShowMedia={props.attachments.showMedia}
      sync={syncMarker(state.sync)}
      onSelectDesktop={(n: number) => {
        dispatch({ type: 'layout', action: { type: 'goToDesktop', n } });
      }}
      onCloseDesktop={(n: number) => {
        dispatch({ type: 'layout', action: { type: 'closeDesktop', n } });
      }}
      onSelectWindow={(number: number) => {
        dispatch({ type: 'windows', action: { type: 'activateNumber', number } });
      }}
    />
  );
}
