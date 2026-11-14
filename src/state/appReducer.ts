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

/**
 * The settings with {@link patch} laid over {@link current} — a patch only
 * names the knobs it turns. The current object when the patch asked for what
 * they already are.
 */
export function mergedSettings(current: Settings, patch: Partial<Settings>): Settings {
  const merged: Settings = { ...current, ...patch };
  if (
    merged.clockFormat === current.clockFormat &&
    merged.defaultVisibility === current.defaultVisibility &&
    merged.effects === current.effects &&
    merged.expandMedia === current.expandMedia
  ) {
    return current;
  }
  return merged;
}
