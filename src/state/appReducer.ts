/**
 * The piecewise transitions the core reducer is built from (AGENTS.md "Layout").
 * Each one takes the smallest thing it needs — a window list, the buffer map,
 * the account list, the settings — and hands back the very same object when its
 * request changes nothing, so the reducer can tell whether the app state moves
 * at all and React can compare by identity. Nothing here names the whole app
 * state: ./appState does, and it is the only caller.
 */

import { type Buffer, EMPTY_BUFFER } from './buffer';
import type { Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import type { InstanceProfile } from '../capabilities/detect';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowState, WindowsState } from '../windows/model';

/**
 * The window a printed line belongs to: the one {@link windowId} names, the
 * active window for `null`, and window 1 — the status window, which is never
 * closed — for an id no window has.
 */
export function printTarget(windows: WindowsState, windowId: string | null): string {
  const id = windowId ?? activeWindow(windows).id;
  return windows.windows.some((win) => win.id === id) ? id : STATUS_WINDOW_ID;
}

/**
 * The buffers of exactly the windows on {@link windows}: a fresh empty buffer
 * for every window that has none, and the buffer of every closed window
 * dropped so a window that is opened again starts clean. The same map when the
 * two already agree.
 */
export function syncBuffers(
  windows: readonly WindowState[],
  buffers: ReadonlyMap<string, Buffer>,
): ReadonlyMap<string, Buffer> {
  const open = new Set(windows.map((win) => win.id));
  const missing = windows.filter((win) => !buffers.has(win.id));
  const closed = [...buffers.keys()].filter((id) => !open.has(id));
  if (missing.length === 0 && closed.length === 0) {
    return buffers;
  }
  const next = new Map(buffers);
  for (const id of closed) {
    next.delete(id);
  }
  for (const win of missing) {
    next.set(win.id, EMPTY_BUFFER);
  }
  return next;
}

/** The buffers with window {@link id} holding {@link buffer}; the same map when it already does. */
export function putBuffer(
  buffers: ReadonlyMap<string, Buffer>,
  id: string,
  buffer: Buffer,
): ReadonlyMap<string, Buffer> {
  if (buffers.get(id) === buffer) {
    return buffers;
  }
  return new Map(buffers).set(id, buffer);
}

/** Whether clearing {@link buffer} would take anything away. */
export function isBlank(buffer: Buffer): boolean {
  return buffer.lines.length === 0 && buffer.selectedKey === null && buffer.revealed.size === 0;
}

/** {@link accounts} still holding {@link key}; the key of a signed-out state, null. */
export function knownActiveKey(
  accounts: readonly StoredAccount[],
  key: string | null,
): string | null {
  if (key === null || accounts.some((account) => account.key === key)) {
    return key;
  }
  return null;
}

/** Whether two account lists hold the same records in the same order. */
export function sameAccounts(
  first: readonly StoredAccount[],
  second: readonly StoredAccount[],
): boolean {
  return (
    first.length === second.length && first.every((account, index) => account === second[index])
  );
}

/**
 * The expired keys that still stand after the account list moves from
 * {@link before} to {@link after}: an account that left, or whose token was
 * replaced (a refresh, a fresh login), is no longer expired. The same set
 * when nothing drops.
 */
function stillExpired(
  expired: ReadonlySet<string>,
  before: readonly StoredAccount[],
  after: readonly StoredAccount[],
): ReadonlySet<string> {
  const kept = [...expired].filter((key) => {
    const now = after.find((account) => account.key === key);
    return now !== undefined && before.find((account) => account.key === key)?.token === now.token;
  });
  return kept.length === expired.size ? expired : new Set(kept);
}

/** What the signed-in accounts own of the app state. */
export type AccountsSlice = {
  readonly accounts: readonly StoredAccount[];
  readonly activeAccountKey: string | null;
  readonly expired: ReadonlySet<string>;
};

/** The state with the accounts and active pointer set, stale pointers dropped; the same state when nothing moved. */
export function withAccounts<S extends AccountsSlice>(
  state: S,
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): S {
  const key = knownActiveKey(accounts, activeKey);
  const expired = stillExpired(state.expired, state.accounts, accounts);
  const same = key === state.activeAccountKey && sameAccounts(state.accounts, accounts);
  return same && expired === state.expired
    ? state
    : { ...state, accounts, activeAccountKey: key, expired };
}

/** The expired keys with {@link key} added; the same set when it is already there. */
export function withExpired(expired: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return expired.has(key) ? expired : new Set(expired).add(key);
}

/** The profiles with {@link profile} stored under its origin; the same map when that very object is already there. */
export function putProfile(
  profiles: ReadonlyMap<string, InstanceProfile>,
  profile: InstanceProfile,
): ReadonlyMap<string, InstanceProfile> {
  if (profiles.get(profile.origin) === profile) {
    return profiles;
  }
  return new Map(profiles).set(profile.origin, profile);
}

/** Whether the knobs that change how things look are the same in both. */
function sameLook(a: Settings, b: Settings): boolean {
  return (
    a.avatars === b.avatars &&
    a.clockFormat === b.clockFormat &&
    a.density === b.density &&
    a.images === b.images &&
    a.theme === b.theme
  );
}

/** Whether the knobs that change what is stored or shown are the same in both. */
function sameBehaviour(a: Settings, b: Settings): boolean {
  return (
    a.defaultVisibility === b.defaultVisibility &&
    a.effects === b.effects &&
    a.expandMedia === b.expandMedia &&
    a.feeds === b.feeds &&
    a.keyOverrides === b.keyOverrides &&
    a.streamMade === b.streamMade
  );
}

/**
 * The settings with {@link patch} laid over {@link current} — a patch only
 * names the knobs it turns. The current object when the patch asked for what
 * they already are.
 */
export function mergedSettings(current: Settings, patch: Partial<Settings>): Settings {
  const merged: Settings = { ...current, ...patch };
  return sameLook(merged, current) && sameBehaviour(merged, current) ? current : merged;
}

/** {@link state} with {@link value} under {@link key}; the very same state when it is already that value. */
export function replacing<S, K extends keyof S>(state: S, key: K, value: S[K]): S {
  return value === state[key] ? state : { ...state, [key]: value };
}
