/**
 * Tests for the stream feed at startup (WFE-243): an account a login redirect
 * signed in joins an automatic stream, or prints the hint for an edited one,
 * or changes nothing; and a desk-less start makes the stream on the first run
 * and shows it in place of the per-account windows, shows an automatic stream
 * again, and otherwise falls back to the home and notifications windows.
 */
import { describe, expect, it, vi } from 'vitest';

import { type StreamDeps, joinStreamAtStartup, openDefaultWindows } from './startupStream';
import type { FeedSpec } from '../state/feeds';
import type { AppAction } from '../state/reducer';
import { DEFAULT_SETTINGS } from '../state/settings';
import type { Settings } from '../state/settings';
import type { Dispatch } from '../state/StateContext';
import { BOB, LAIN } from '../test/deskFixtures';

const NOW = new Date('2026-11-25T10:00:00.000Z');

/** A stream of Lain's, automatic unless told otherwise. */
function streamOf(auto: boolean): FeedSpec {
  return {
    id: 'f1',
    name: 'stream',
    sources: [{ accountKey: LAIN.key, source: 'home' }],
    ...(auto ? { auto } : {}),
  };
}

/** Settings holding {@link feeds}. */
function withFeeds(feeds: Settings['feeds'], streamMade = true): Settings {
  return { ...DEFAULT_SETTINGS, feeds, streamMade };
}

/** Dependencies that record what was dispatched. */
function recorder(): { readonly deps: StreamDeps; readonly actions: () => readonly AppAction[] } {
  const dispatch = vi.fn<Dispatch>();
  return {
    deps: { dispatch, now: () => NOW },
    actions: () => dispatch.mock.calls.map(([action]) => action),
  };
}

describe(joinStreamAtStartup, () => {
  it('changes nothing when no login signed an account in', () => {
    const { deps, actions } = recorder();
    const settings = withFeeds([streamOf(true)]);

    expect(joinStreamAtStartup(deps, settings, null)).toBe(settings);
    expect(actions()).toStrictEqual([]);
  });

  it('saves the sources the new account adds to an automatic stream', () => {
    const { deps, actions } = recorder();

    const settings = joinStreamAtStartup(deps, withFeeds([streamOf(true)]), BOB);

    expect(settings.feeds[0]?.sources).toHaveLength(5);
    expect(actions()).toStrictEqual([{ type: 'settings', settings: { feeds: settings.feeds } }]);
  });

  it('prints the hint and saves nothing for an edited stream', () => {
    const { deps, actions } = recorder();
    const settings = withFeeds([streamOf(false)]);

    expect(joinStreamAtStartup(deps, settings, BOB).feeds).toBe(settings.feeds);
    expect(actions()).toStrictEqual([
      {
        type: 'print',
        windowId: 'status',
        date: NOW,
        level: 'info',
        text: expect.stringContaining('/feed add stream @bob@b.example:home') as unknown,
      },
    ]);
  });

  it('does nothing when there is no stream to join', () => {
    const { deps, actions } = recorder();

    joinStreamAtStartup(deps, withFeeds([]), BOB);

    expect(actions()).toStrictEqual([]);
  });
});

describe(openDefaultWindows, () => {
  it('makes the stream on a first run and opens it alone', () => {
    const { deps, actions } = recorder();

    openDefaultWindows(deps, {
      settings: withFeeds([], false),
      accounts: [LAIN, BOB],
      activeKey: LAIN.key,
    });

    expect(actions()).toMatchObject([
      { type: 'settings', settings: { streamMade: true, feeds: [{ name: 'stream', auto: true }] } },
      { type: 'windows', action: { type: 'open', title: '~stream' } },
    ]);
  });

  it('opens a stream that is still automatic without saving anything', () => {
    const { deps, actions } = recorder();

    openDefaultWindows(deps, {
      settings: withFeeds([streamOf(true)]),
      accounts: [LAIN],
      activeKey: LAIN.key,
    });

    expect(actions()).toStrictEqual([
      {
        type: 'windows',
        action: {
          type: 'open',
          ref: { kind: 'feed', accountKey: null, target: 'f1' },
          title: '~stream',
        },
      },
    ]);
  });

  it('opens each account’s home and notifications windows when there is no stream to show', () => {
    const { deps, actions } = recorder();

    openDefaultWindows(deps, { settings: withFeeds([]), accounts: [LAIN], activeKey: LAIN.key });

    expect(actions().map((action) => action.type === 'windows' && action.action)).toMatchObject([
      { type: 'open', title: 'home' },
      { type: 'open', title: 'notifs' },
    ]);
  });
});
