/**
 * The polling fallback for an account whose stream is down (AGENTS.md
 * "Windows, like IRC buffers"): every minute, fetch the newest page of the
 * home timeline and of the notifications and deliver each as `newer` into the
 * account's open windows of those kinds, where the buffers skip what they
 * already hold. A failed poll is silent — the next one is a minute away, and
 * a refused token already expires the account through ../state/refreshSession.
 * The clock is a {@link Scheduler}, so tests drive it by hand.
 */

import { listNotifications } from '../api/endpoints/notifications';
import { homeTimeline } from '../api/endpoints/timelines';
import { statusesAction } from '../state/pageActions';
import { type RefreshDeps, withFreshToken } from '../state/refreshSession';
import type { WindowKind } from '../windows/model';

/** How often a down stream is polled, in milliseconds. */
export const POLL_INTERVAL_MS = 60_000;

/** How many items each poll asks for. */
const POLL_LIMIT = 20;

/** Runs {@link task} every {@link ms} milliseconds until the returned function is called. */
export type Scheduler = (task: () => void, ms: number) => () => void;

/** The real clock: `setInterval`, cleared by the returned function. */
export function intervalScheduler(task: () => void, ms: number): () => void {
  const id = setInterval(task, ms);
  return () => {
    clearInterval(id);
  };
}

/** The ids of the account's open windows of {@link kind}. */
function windowsOf(deps: RefreshDeps, accountKey: string, kind: WindowKind): readonly string[] {
  return deps
    .getState()
    .windows.windows.filter((win) => win.ref.kind === kind && win.ref.accountKey === accountKey)
    .map((win) => win.id);
}

/** Fetches the newest home page and delivers it to the account's home windows. */
async function pollHome(deps: RefreshDeps, accountKey: string): Promise<void> {
  const result = await withFreshToken(
    deps,
    accountKey,
    async (session) => await homeTimeline(session, { limit: POLL_LIMIT }),
  );
  if (!result.ok) {
    return;
  }
  for (const id of windowsOf(deps, accountKey, 'home')) {
    deps.dispatch(statusesAction(id, result.value.items, 'newer'));
  }
}

/** Fetches the newest notifications and delivers them to the account's notifications windows. */
async function pollNotifications(deps: RefreshDeps, accountKey: string): Promise<void> {
  const result = await withFreshToken(
    deps,
    accountKey,
    async (session) => await listNotifications(session, { page: { limit: POLL_LIMIT } }),
  );
  if (!result.ok) {
    return;
  }
  for (const windowId of windowsOf(deps, accountKey, 'notifications')) {
    deps.dispatch({
      type: 'notifications',
      windowId,
      notifications: result.value.items,
      where: 'newer',
    });
  }
}

/**
 * Starts polling {@link accountKey} every {@link POLL_INTERVAL_MS} on
 * {@link schedule}; the returned function stops it.
 */
export function startPollFallback(
  deps: RefreshDeps,
  accountKey: string,
  schedule: Scheduler,
): () => void {
  return schedule(() => {
    void pollHome(deps, accountKey);
    void pollNotifications(deps, accountKey);
  }, POLL_INTERVAL_MS);
}
