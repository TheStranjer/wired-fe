/**
 * Tests for the streams a feed window needs: each kind of source asks its own
 * account's connection for the stream that carries it, a source of another
 * account asks that account's, two windows over the same source share one
 * subscription, and a feed that is gone or has no id asks for nothing.
 */
import { describe, expect, it } from 'vitest';

import { sourceTopic, wantedStreams } from './streamTopics';
import { coreReducer } from '../state/appState';
import type { FeedSource, FeedSpec } from '../state/feeds';
import { A_ACCOUNT, B_ACCOUNT, feedState } from '../test/feedWindow';

/** A feed {@link id} over the sources {@link sources} of lain (a) and navi (b). */
function spec(id: string, sources: readonly [string, FeedSource][]): FeedSpec {
  return {
    id,
    name: id,
    sources: sources.map(([who, source]) => ({
      accountKey: who === 'a' ? A_ACCOUNT.key : B_ACCOUNT.key,
      source,
    })),
  };
}

describe(sourceTopic, () => {
  it.each([
    ['home', { stream: 'user' }],
    ['mentions', { stream: 'user:notification' }],
    ['notifications', { stream: 'user:notification' }],
    ['dms', { stream: 'direct' }],
    ['local', { stream: 'public:local' }],
    ['federated', { stream: 'public' }],
    ['tag:Rust', { stream: 'hashtag', tag: 'rust' }],
  ] as const)('maps %s to its stream', (source, expected) => {
    expect(sourceTopic(source)).toStrictEqual(expected);
  });
});

describe('wantedStreams for feed windows', () => {
  const everything = spec('f1', [
    ['a', 'home'],
    ['a', 'mentions'],
    ['a', 'notifications'],
    ['a', 'dms'],
    ['a', 'local'],
    ['a', 'federated'],
    ['a', 'tag:lain'],
    ['b', 'federated'],
  ]);

  it("joins each source's stream on its own account's connection, once each", () => {
    const state = feedState([everything]);

    expect(wantedStreams(state.windows.windows, A_ACCOUNT.key, state.settings.feeds)).toStrictEqual(
      [
        { stream: 'user' },
        { stream: 'user:notification' },
        { stream: 'direct' },
        { stream: 'public:local' },
        { stream: 'public' },
        { stream: 'hashtag', tag: 'lain' },
      ],
    );
    expect(wantedStreams(state.windows.windows, B_ACCOUNT.key, state.settings.feeds)).toStrictEqual(
      [{ stream: 'user' }, { stream: 'public' }],
    );
  });

  it('asks for nothing extra for a feed that is gone or has no id', () => {
    const gone = feedState([everything], 'missing');
    const bare = feedState([everything], null);

    expect(wantedStreams(gone.windows.windows, A_ACCOUNT.key, gone.settings.feeds)).toStrictEqual([
      { stream: 'user' },
    ]);
    expect(wantedStreams(bare.windows.windows, A_ACCOUNT.key, bare.settings.feeds)).toStrictEqual([
      { stream: 'user' },
    ]);
  });

  it('shares one subscription between two windows that read the same stream', () => {
    const first = feedState([spec('f1', [['a', 'local']]), spec('f2', [['a', 'local']])]);
    const both = coreReducer(first, {
      type: 'windows',
      action: { type: 'open', ref: { kind: 'feed', accountKey: null, target: 'f2' }, title: '~f2' },
    });

    expect(both.windows.windows.filter((win) => win.ref.kind === 'feed')).toHaveLength(2);
    expect(wantedStreams(both.windows.windows, A_ACCOUNT.key, both.settings.feeds)).toStrictEqual([
      { stream: 'user' },
      { stream: 'public:local' },
    ]);
  });
});
