/**
 * What the steps of the desk sync (./deskSyncOps) share (decision 17): the
 * injected {@link SyncDeps}, the {@link SyncSession} that lives for the page,
 * the queue that keeps two steps from overlapping, and the small helpers that
 * pick the account, report the status and warn once per kind of trouble.
 */
import type { DeskSource } from './deskSource';
import type { StoredAccount } from '../accounts/accountStore';
import type { SyncPrefs } from '../accounts/syncPrefs';
import type { ProfileStorage } from '../capabilities/profileCache';
import { type AppState, printAction } from '../state/appState';
import type { LineLevel } from '../state/buffer';
import { accountByKey } from '../state/selectors';
import type { Dispatch } from '../state/StateContext';
import { pickSyncAccount } from '../state/syncAccount';
import type { SyncStatus } from '../state/syncStatus';
import { STATUS_WINDOW_ID } from '../windows/model';

/** What the sync reads and writes outside itself. */
export type SyncIo = {
  readonly getState: () => AppState;
  readonly dispatch: Dispatch;
  /** The reader's local sync choices (`/sync`). */
  readonly prefs: () => SyncPrefs;
  /** Where this device's desk and its stamp are kept. */
  readonly source: DeskSource;
  /** Where instance profiles are cached, for the 404/501 rule. */
  readonly profiles: ProfileStorage;
  /** The current moment, ms since the epoch. */
  readonly now: () => number;
};

/** One value that can be read and replaced. */
type Cell<T> = { readonly get: () => T; readonly set: (value: T) => void };

/** A {@link Cell} holding {@link initial}. */
function cell<T>(initial: T): Cell<T> {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

/** What lives for the page's session. */
export type SyncSession = {
  /** The last step queued; the next one starts after it. */
  readonly tail: Cell<Promise<void>>;
  /** The key of the account the last pull succeeded on; null before one did. */
  readonly pulledKey: Cell<string | null>;
  /** The kinds of error already warned about. */
  readonly warned: Set<string>;
  /** The text of the desk and settings as last seen, for telling a change from none. */
  readonly baseline: Cell<string | null>;
};

/** A session that has done nothing yet. */
export function newSession(): SyncSession {
  return {
    tail: cell(Promise.resolve()),
    pulledKey: cell<string | null>(null),
    warned: new Set(),
    baseline: cell<string | null>(null),
  };
}

/** The {@link SyncIo} plus the push timer and the session the engine owns. */
export type SyncDeps = SyncIo & {
  /** Waits for the push delay, restarting it when it already waits. */
  readonly arm: () => void;
  /** Stops waiting. */
  readonly cancel: () => void;
  /** Whether a push is waiting for its delay. */
  readonly armed: () => boolean;
  readonly session: SyncSession;
};

/** Queues {@link op} after the steps already queued, so two never overlap. */
export function enqueue(session: SyncSession, op: () => Promise<unknown>): void {
  session.tail.set(
    session.tail
      .get()
      .then(op)
      .then(() => undefined),
  );
}

/** The status fields {@link patch}, with `pending` as the push timer says. */
export function report(deps: SyncDeps, patch: Partial<SyncStatus>): void {
  deps.dispatch({ type: 'sync', status: { ...patch, pending: deps.armed() } });
}

/** Prints {@link text} into the status window. */
export function say(deps: SyncDeps, level: LineLevel, text: string): void {
  deps.dispatch(printAction(STATUS_WINDOW_ID, level, text));
}

/** Warns {@link text} unless this {@link kind} of trouble was warned about already. */
export function warnOnce(deps: SyncDeps, kind: string, text: string): void {
  if (!deps.session.warned.has(kind)) {
    deps.session.warned.add(kind);
    say(deps, 'warn', text);
  }
}

/** The account that holds the synced desk now, or null when none can. */
export function target(deps: SyncDeps): StoredAccount | null {
  const state = deps.getState();
  return accountByKey(state, pickSyncAccount(deps.prefs(), state));
}
