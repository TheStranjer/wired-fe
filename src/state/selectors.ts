/**
 * The read-only views over the whole app state (AGENTS.md "Layout"): whose
 * account the client is acting as, how it connects to its instance, what that
 * instance turned out to be, what a window's scrollback holds, and which
 * account a window belongs to. Selectors invent nothing: missing data reads
 * back as `null` or {@link EMPTY_BUFFER}, and each returns the stored object
 * itself where it can, so callers can compare results by identity.
 */

import { anonSession, isAnonKey } from './anonAccount';
import type { AppState } from './appState';
import { type Buffer, EMPTY_BUFFER } from './buffer';
import { resolveDisplay, type ResolvedDisplay } from './resolveDisplay';
import type { StoredAccount } from '../accounts/accountStore';
import type { ApiSession } from '../api/session';
import type { Capabilities } from '../capabilities/capabilities';
import { findPlaced } from '../windows/desktopPanes';
import type { Desktop, PlacedPane } from '../windows/desktopPanes';
import { activeDesktop as activeDesktopOf } from '../windows/desktops';
import { activeWindow } from '../windows/model';

/** The desktop being shown. */
export function activeDesktop(state: AppState): Desktop {
  return activeDesktopOf(state.layout);
}

/**
 * The focused pane or float of the active desktop (`rect` is null for a tree
 * pane); null when the desktop is empty.
 */
export function focusedPane(state: AppState): PlacedPane | null {
  const desktop = activeDesktop(state);
  return desktop.focusedPaneId === null ? null : findPlaced(desktop, desktop.focusedPaneId);
}

/** The account stored under {@link key}; null for a null key or no such account. */
export function accountByKey(state: AppState, key: string | null): StoredAccount | null {
  if (key === null) {
    return null;
  }
  return state.accounts.find((account) => account.key === key) ?? null;
}

/** The account commands act as; null while nobody is signed in. */
export function activeAccount(state: AppState): StoredAccount | null {
  return accountByKey(state, state.activeAccountKey);
}

/**
 * The account's connection to its instance: its origin and bearer token. A
 * signed-out key (./anonAccount) has the origin and no token.
 */
export function sessionFor(state: AppState, accountKey: string | null): ApiSession | null {
  const anon = anonSession(accountKey);
  if (anon !== null) {
    return anon;
  }
  const account = accountByKey(state, accountKey);
  if (account === null) {
    return null;
  }
  return { origin: account.origin, token: account.token };
}

/** What the account's instance turned out to be (decision 5); null while that origin is unknown. */
export function capabilitiesFor(state: AppState, accountKey: string | null): Capabilities | null {
  const account = accountByKey(state, accountKey);
  if (account === null) {
    return null;
  }
  return state.profiles.get(account.origin)?.capabilities ?? null;
}

/** The window's scrollback; {@link EMPTY_BUFFER} when no buffer holds {@link windowId}. */
export function bufferFor(state: AppState, windowId: string): Buffer {
  return state.buffers.get(windowId) ?? EMPTY_BUFFER;
}

/**
 * The display values window {@link windowId} draws with: the reader's settings
 * under the window's own overrides (decision 15). A window that no longer
 * exists inherits every setting.
 */
export function displayFor(state: AppState, windowId: string): ResolvedDisplay {
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  return resolveDisplay(state.settings, win?.display ?? {});
}

/** The active window's scrollback. */
export function activeBuffer(state: AppState): Buffer {
  return bufferFor(state, activeWindow(state.windows).id);
}

/** The account a window acts as: its ref.accountKey, or the active account for the status window. */
export function windowAccountKey(state: AppState, windowId: string): string | null {
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  if (win === undefined) {
    return null;
  }
  return win.ref.accountKey ?? state.activeAccountKey;
}

/**
 * The key a window's loads sign with: its account's, when that account is
 * signed in, or its signed-out key (./anonAccount); null when it has neither.
 */
export function loadKeyFor(state: AppState, windowId: string): string | null {
  const key = windowAccountKey(state, windowId);
  return isAnonKey(key) ? key : (accountByKey(state, key)?.key ?? null);
}
