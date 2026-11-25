/**
 * Tests for the stream plan: `user` always, a public stream per local or
 * federated window, a tagged stream per hashtag window, only for the account
 * asked about; and the sync that joins and leaves only the difference.
 */
import { describe, expect, it, vi } from 'vitest';

import { syncSubscriptions, wantedStreams } from './streamTopics';
import type { StreamSubscription } from '../api/streamClient';
import { MINE, THEIRS, offscreen } from '../test/streamWindows';
import type { WindowRef } from '../windows/model';

const LOCAL: WindowRef = { kind: 'local', accountKey: MINE, target: null };
const FEDERATED: WindowRef = { kind: 'federated', accountKey: MINE, target: null };
const TAG: WindowRef = { kind: 'hashtag', accountKey: MINE, target: 'lain' };
const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };

describe(wantedStreams, () => {
  it('is the user stream alone with nothing open', () => {
    expect(wantedStreams(offscreen().windows.windows, MINE, [])).toStrictEqual([
      { stream: 'user' },
    ]);
  });

  it('adds a stream per window that one feeds, once each', () => {
    const windows = offscreen(LOCAL, FEDERATED, TAG, HOME).windows.windows;

    expect(wantedStreams(windows, MINE, [])).toStrictEqual([
      { stream: 'user' },
      { stream: 'public:local' },
      { stream: 'public' },
      { stream: 'hashtag', tag: 'lain' },
    ]);
  });

  it("leaves out another account's windows and a hashtag window without a tag", () => {
    const theirs: WindowRef = { kind: 'local', accountKey: THEIRS, target: null };
    const bare: WindowRef = { kind: 'hashtag', accountKey: MINE, target: null };
    const windows = offscreen(theirs, bare).windows.windows;

    expect(wantedStreams(windows, MINE, [])).toStrictEqual([{ stream: 'user' }]);
    expect(wantedStreams(windows, THEIRS, [])).toStrictEqual([
      { stream: 'user' },
      { stream: 'public:local' },
    ]);
  });
});

describe(syncSubscriptions, () => {
  it('joins what is new, leaves what is gone, and keeps the rest', () => {
    const connection = {
      subscribe: vi.fn<(subscription: StreamSubscription) => void>(),
      unsubscribe: vi.fn<(subscription: StreamSubscription) => void>(),
    };
    const joined = { connection, subs: new Map<string, StreamSubscription>() };
    syncSubscriptions(joined, [{ stream: 'user' }, { stream: 'public' }]);

    expect(connection.subscribe.mock.calls).toStrictEqual([
      [{ stream: 'user' }],
      [{ stream: 'public' }],
    ]);

    syncSubscriptions(joined, [{ stream: 'user' }, { stream: 'hashtag', tag: 'a' }]);

    expect(connection.unsubscribe.mock.calls).toStrictEqual([[{ stream: 'public' }]]);
    expect(connection.subscribe).toHaveBeenLastCalledWith({ stream: 'hashtag', tag: 'a' });
    expect(connection.subscribe).toHaveBeenCalledTimes(3);
  });
});
