/**
 * Tests for the polling fallback over the shared MSW server: a tick of the
 * scheduler fetches the newest 20 home posts and notifications and delivers
 * each as `newer` to the account's open windows of that kind; a failed fetch
 * delivers nothing; stopping goes through the scheduler. The real clock is
 * checked with fake timers.
 */
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POLL_INTERVAL_MS, intervalScheduler, startPollFallback } from './pollFallback';
import type { AppAction } from '../state/reducer';
import type { RefreshDeps } from '../state/refreshSession';
import { notification, status } from '../test/fixtures';
import { manualScheduler } from '../test/manualScheduler';
import { server } from '../test/server';
import { MINE, THEIRS, offscreen } from '../test/streamWindows';
import { type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';
const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };
const NOTIFS: WindowRef = { kind: 'notifications', accountKey: MINE, target: null };
const THEIR_HOME: WindowRef = { kind: 'home', accountKey: THEIRS, target: null };

/** Deps over a state with {@link views} open, recording what is dispatched. */
function deps(...views: readonly WindowRef[]): {
  readonly refresh: RefreshDeps;
  readonly dispatched: AppAction[];
} {
  const state = offscreen(...views);
  const dispatched: AppAction[] = [];
  const refresh: RefreshDeps = {
    refresher: null,
    getState: () => state,
    dispatch: (action) => dispatched.push(action),
  };

  return { refresh, dispatched };
}

describe(startPollFallback, () => {
  it('polls every minute, asking each list for 20', async () => {
    const queries: string[] = [];
    const record = (request: Request): void => {
      queries.push(new URL(request.url).search);
    };
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, ({ request }) => {
        record(request);

        return HttpResponse.json([]);
      }),
      http.get(`${ORIGIN}/api/v1/notifications`, ({ request }) => {
        record(request);

        return HttpResponse.json([]);
      }),
    );
    const clock = manualScheduler();
    startPollFallback(deps().refresh, MINE, clock.schedule);

    expect(clock.intervals).toStrictEqual([POLL_INTERVAL_MS]);
    expect(POLL_INTERVAL_MS).toBe(60_000);

    clock.tick();
    await vi.waitFor(() => {
      expect(queries).toStrictEqual(['?limit=20', '?limit=20']);
    });
  });

  it('delivers both lists as newer to the account’s own windows', async () => {
    const post = status('1');
    const note = notification('9', status('2'));
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([post])),
      http.get(`${ORIGIN}/api/v1/notifications`, () => HttpResponse.json([note])),
    );
    const { refresh, dispatched } = deps(HOME, NOTIFS, THEIR_HOME);
    const clock = manualScheduler();
    startPollFallback(refresh, MINE, clock.schedule);
    clock.tick();
    await vi.waitFor(() => {
      expect(dispatched).toHaveLength(2);
    });

    expect(dispatched).toContainEqual({
      type: 'statuses',
      windowId: windowId(HOME),
      statuses: [post],
      where: 'newer',
    });
    expect(dispatched).toContainEqual({
      type: 'notifications',
      windowId: windowId(NOTIFS),
      notifications: [note],
      where: 'newer',
    });
  });

  it('delivers nothing for a list that failed', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json({ error: 'down' }, { status: 500 }),
      ),
      http.get(`${ORIGIN}/api/v1/notifications`, () => HttpResponse.json([])),
    );
    const { refresh, dispatched } = deps(HOME, NOTIFS);
    const clock = manualScheduler();
    startPollFallback(refresh, MINE, clock.schedule);
    clock.tick();
    await vi.waitFor(() => {
      expect(dispatched).toHaveLength(1);
    });

    expect(dispatched[0]).toMatchObject({ type: 'notifications' });
  });

  it('stops through the scheduler', () => {
    const clock = manualScheduler();
    startPollFallback(deps().refresh, MINE, clock.schedule)();

    expect(clock.stop).toHaveBeenCalledTimes(1);
  });
});

describe(intervalScheduler, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the task each interval until stopped', () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const stop = intervalScheduler(task, 60_000);
    vi.advanceTimersByTime(120_000);

    expect(task).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(120_000);

    expect(task).toHaveBeenCalledTimes(2);
  });
});
