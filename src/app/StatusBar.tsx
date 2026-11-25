/**
 * The status line wired to real state (AGENTS.md "Windows, like IRC
 * buffers"): the clock, the active account, the desktops and the hidden
 * windows with activity (./statusEntries), the pending media and the hotkey
 * mode. A click on a desktop runs what `/desktop N` runs and a click on a
 * window what `/win N` runs (decision 6). The header and pane titles show an
 * account the same way, through {@link accountLabel}.
 */

import type { JSX } from 'react';

import { statusEntries } from './statusEntries';
import { useClock } from './useClock';
import type { AppState } from '../state/appState';
import { accountByKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { StatusLine } from '../ui/StatusLine';

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

/** The status line: clock, active account, desktops, hidden windows with activity, pending media, pending keys, sync marker and hotkey mode. */
export function StatusBar(props: {
  readonly pendingMedia: number;
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
      desktops={entries.desktops}
      windows={entries.windows}
      mode={state.mode}
      pendingMedia={props.pendingMedia}
      pendingKeys={props.pendingKeys}
      sync={syncMarker(state.sync)}
      onSelectDesktop={(n: number) => {
        dispatch({ type: 'layout', action: { type: 'goToDesktop', n } });
      }}
      onSelectWindow={(number: number) => {
        dispatch({ type: 'windows', action: { type: 'activateNumber', number } });
      }}
    />
  );
}
