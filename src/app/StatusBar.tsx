/**
 * The status line wired to real state (AGENTS.md "Windows, like IRC
 * buffers"): the clock, the active account, every window numbered in display
 * order with its unread count, the pending media and the hotkey mode, and a
 * click on a window's entry activates it (decision 6). The topic bar shows an
 * account the same way, through {@link accountLabel}.
 */

import type { JSX } from 'react';

import { useClock } from './useClock';
import type { AppState } from '../state/appState';
import { accountByKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { StatusLine } from '../ui/StatusLine';
import type { StatusLineWindow } from '../ui/StatusLine';
import { activeWindow } from '../windows/model';

/** The account behind {@link key}, named the way the bars show it; null if none. */
export function accountLabel(state: AppState, key: string | null): string | null {
  const account = accountByKey(state, key);
  return account === null ? null : `@${account.handle}`;
}

/** The status line's entries: every window, numbered in display order. */
function statusWindows(state: AppState): readonly StatusLineWindow[] {
  const active = activeWindow(state.windows);
  return state.windows.windows.map((win, index) => ({
    number: index + 1,
    title: win.title,
    unread: win.unread,
    highlight: win.highlight,
    active: win.id === active.id,
  }));
}

/** The status line: clock, active account, numbered windows, pending media and hotkey mode. */
export function StatusBar(props: { readonly pendingMedia: number }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const clock = useClock(state.settings.clockFormat);
  return (
    <StatusLine
      clock={clock}
      accountLabel={accountLabel(state, state.activeAccountKey)}
      windows={statusWindows(state)}
      mode={state.mode}
      pendingMedia={props.pendingMedia}
      onSelectWindow={(number: number) => {
        dispatch({ type: 'windows', action: { type: 'activateNumber', number } });
      }}
    />
  );
}
