/**
 * Tests for how a streaming frame reaches feed windows: every source of the
 * feed that belongs to the account whose connection delivered the frame decides
 * whether it is that source's news — home on `user`, local and federated on
 * their public streams, a tag in any case, dms on `direct` or a direct post on
 * `user`, notifications always and mentions only for a mention — and a source
 * of another account, a window that is no feed and a feed that is gone hear
 * nothing.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer } from './appState';
import type { FeedItem } from './feedItem';
import type { FeedSource, FeedSpec } from './feeds';
import type { AppAction } from './reducer';
import { streamActions } from './streamActions';
import type { StreamEvent } from '../api/streaming';
import { A_ACCOUNT, B_ACCOUNT, feedState, feedWindowId } from '../test/feedWindow';
import { notification, status } from '../test/fixtures';

/** A feed {@link id} over one source of lain's (a) or navi's (b) per entry. */
function spec(id: string, sources: readonly (readonly ['a' | 'b', FeedSource])[]): FeedSpec {
  return {
    id,
    name: id,
    sources: sources.map(([who, source]) => ({
      accountKey: (who === 'a' ? A_ACCOUNT : B_ACCOUNT).key,
      source,
    })),
  };
}

/** A post arriving on {@link streams}. */
function arriving(streams: readonly string[], visibility = 'public'): StreamEvent {
  return { kind: 'update', stream: streams, status: status('p1', { visibility }) };
}

/** A mention (or, when {@link mention} is false, a follow) arriving. */
function notified(mention: boolean): StreamEvent {
  const post = mention ? status('p1') : null;
  return {
    kind: 'notification',
    stream: ['user:notification'],
    notification: notification('n1', post),
  };
}

/** The items a `feedLive` action in {@link actions} brings to the window {@link windowId}, or null for none. */
function itemsFor(actions: readonly AppAction[], windowId: string): readonly FeedItem[] | null {
  for (const action of actions) {
    if (action.type === 'feedLive' && action.windowId === windowId) {
      return action.items;
    }
  }
  return null;
}

/** What lain's connection makes of {@link event} for the feed holding one source of {@link source}. */
function heard(source: FeedSource, event: StreamEvent, who: 'a' | 'b' = 'a'): AppAction[] {
  const state = feedState([spec('f1', [[who, source]])]);
  return [...streamActions(state, A_ACCOUNT.key, event)];
}

/** The ids of the sources the feed window heard {@link event} for. */
function sourcesHeard(state: AppState, event: StreamEvent): readonly string[] | null {
  const items = itemsFor(streamActions(state, A_ACCOUNT.key, event), feedWindowId('f1'));
  return items === null ? null : items.map((item) => item.source.source);
}

describe('a post reaching a feed', () => {
  it('stamps the item with the source and the account that heard it', () => {
    const items = itemsFor(heard('home', arriving(['user'])), feedWindowId('f1'));

    expect(items).toHaveLength(1);
    expect(items?.[0]).toMatchObject({
      kind: 'post',
      accountKey: A_ACCOUNT.key,
      seenBy: [A_ACCOUNT.key],
      source: { accountKey: A_ACCOUNT.key, source: 'home' },
    });
  });

  it.each([
    ['home', ['user'], true],
    ['home', ['public'], false],
    ['local', ['public:local'], true],
    ['local', ['public'], false],
    ['federated', ['public'], true],
    ['federated', ['public:local'], false],
    ['tag:Lain', ['hashtag', 'lain'], true],
    ['tag:lain', ['hashtag', 'LAIN'], true],
    ['tag:lain', ['hashtag', 'navi'], false],
    ['dms', ['direct'], true],
    ['dms', ['public'], false],
    ['mentions', ['user'], false],
    ['notifications', ['user'], false],
  ] as const)('reaches source %s from %j: %s', (source, streams, reaches) => {
    expect(itemsFor(heard(source, arriving(streams)), feedWindowId('f1')) !== null).toBe(reaches);
  });

  it('reaches dms from a direct post on the user stream, not from another one', () => {
    expect(itemsFor(heard('dms', arriving(['user'], 'direct')), feedWindowId('f1'))).toHaveLength(
      1,
    );
    expect(itemsFor(heard('dms', arriving(['user'])), feedWindowId('f1'))).toBeNull();
  });

  it('does not reach a source of the other account', () => {
    expect(itemsFor(heard('home', arriving(['user']), 'b'), feedWindowId('f1'))).toBeNull();
  });

  it('brings one item per source of the account that takes it, in one action', () => {
    const state = feedState([
      spec('f1', [
        ['a', 'home'],
        ['a', 'local'],
        ['b', 'home'],
      ]),
    ]);

    expect(sourcesHeard(state, arriving(['user', 'public:local']))).toStrictEqual([
      'home',
      'local',
    ]);
  });

  it('reaches every feed window with a source that takes it', () => {
    const first = feedState([spec('f1', [['a', 'home']]), spec('f2', [['a', 'home']])]);
    const both = coreReducer(first, {
      type: 'windows',
      action: { type: 'open', ref: { kind: 'feed', accountKey: null, target: 'f2' }, title: '~f2' },
    });
    const live = streamActions(both, A_ACCOUNT.key, arriving(['user'])).flatMap((action) =>
      action.type === 'feedLive' ? [action.windowId] : [],
    );

    expect(live).toStrictEqual([feedWindowId('f1'), feedWindowId('f2')]);
  });

  it('does not reach a feed that is gone or has no id', () => {
    expect(
      itemsFor(
        streamActions(feedState([], 'gone'), A_ACCOUNT.key, arriving(['user'])),
        feedWindowId('gone'),
      ),
    ).toBeNull();
    expect(
      streamActions(
        feedState([spec('f1', [['a', 'home']])], null),
        A_ACCOUNT.key,
        arriving(['user']),
      ),
    ).toStrictEqual([]);
  });
});

describe('a notification reaching a feed', () => {
  it('reaches notifications whatever it is', () => {
    expect(
      itemsFor(heard('notifications', notified(false)), feedWindowId('f1'))?.[0],
    ).toMatchObject({
      kind: 'notification',
      accountKey: A_ACCOUNT.key,
    });
  });

  it('reaches mentions only when it is a mention', () => {
    expect(itemsFor(heard('mentions', notified(true)), feedWindowId('f1'))).toHaveLength(1);
    expect(itemsFor(heard('mentions', notified(false)), feedWindowId('f1'))).toBeNull();
  });

  it('does not reach a timeline source', () => {
    expect(itemsFor(heard('home', notified(true)), feedWindowId('f1'))).toBeNull();
  });
});
