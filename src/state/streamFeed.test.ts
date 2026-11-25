/**
 * Tests for the default `stream` feed (WFE-243): what is made for the first
 * sign-in (four sources per account, automatic), when nothing is made (nobody
 * signed in, any feed saved, or one made before), how a later account joins an
 * automatic stream or earns the hint for an edited one, and what a desk-less
 * startup shows.
 */
import { describe, expect, it } from 'vitest';

import type { FeedSpec } from './feeds';
import { DEFAULT_SETTINGS } from './settings';
import { defaultFeedFor, joinStream, startupStream, streamSeed } from './streamFeed';
import { BOB, LAIN } from '../test/deskFixtures';

/** The stream as the first sign-in of Lain alone makes it. */
const LAIN_STREAM: FeedSpec = {
  id: 'f1',
  name: 'stream',
  auto: true,
  sources: [
    { accountKey: LAIN.key, source: 'home' },
    { accountKey: LAIN.key, source: 'mentions' },
    { accountKey: LAIN.key, source: 'dms' },
    { accountKey: LAIN.key, source: 'notifications' },
  ],
};

/** The four sources Bob adds. */
const BOB_SOURCES = (['home', 'mentions', 'dms', 'notifications'] as const).map((source) => ({
  accountKey: BOB.key,
  source,
}));

describe(defaultFeedFor, () => {
  it('makes an automatic stream of every account’s four sources, one source at a time', () => {
    const feed = defaultFeedFor([LAIN, BOB], []);

    expect(feed?.name).toBe('stream');
    expect(feed?.auto).toBe(true);
    expect(feed?.sources.map((ref) => `${ref.source}:${ref.accountKey}`)).toStrictEqual([
      `home:${LAIN.key}`,
      `home:${BOB.key}`,
      `mentions:${LAIN.key}`,
      `mentions:${BOB.key}`,
      `dms:${LAIN.key}`,
      `dms:${BOB.key}`,
      `notifications:${LAIN.key}`,
      `notifications:${BOB.key}`,
    ]);
  });

  it('makes the feed for one account with the first id', () => {
    expect(defaultFeedFor([LAIN], [])).toStrictEqual(LAIN_STREAM);
  });

  it('makes nothing while nobody is signed in', () => {
    expect(defaultFeedFor([], [])).toBeNull();
  });

  it('makes nothing for a reader who already has feeds', () => {
    expect(defaultFeedFor([LAIN], [{ id: 'f1', name: 'main', sources: [] }])).toBeNull();
  });
});

describe(streamSeed, () => {
  it('seeds a first run', () => {
    expect(streamSeed(DEFAULT_SETTINGS, [LAIN])).toStrictEqual(LAIN_STREAM);
  });

  it('seeds nothing once the stream was made, even with no feeds left', () => {
    expect(streamSeed({ ...DEFAULT_SETTINGS, streamMade: true }, [LAIN])).toBeNull();
  });
});

describe(joinStream, () => {
  it('adds the newcomer’s four sources to an automatic stream and keeps it automatic', () => {
    const join = joinStream([LAIN_STREAM], BOB);

    expect(join.joined).toBe(true);
    expect(join.hint).toBeNull();
    expect(join.feeds).toStrictEqual([
      { ...LAIN_STREAM, sources: [...LAIN_STREAM.sources, ...BOB_SOURCES] },
    ]);
  });

  it('leaves an edited stream alone and hints at /feed add', () => {
    const edited = { ...LAIN_STREAM, auto: undefined };
    const feeds = [edited];

    const join = joinStream(feeds, BOB);

    expect(join.feeds).toBe(feeds);
    expect(join.joined).toBe(false);
    expect(join.hint).toBe(
      '~stream was edited, so @bob@b.example is not in it: /feed add stream ' +
        '@bob@b.example:home @bob@b.example:mentions @bob@b.example:dms @bob@b.example:notifications',
    );
  });

  it('does nothing when there is no stream', () => {
    const feeds = [{ id: 'f1', name: 'main', sources: [] }];

    expect(joinStream(feeds, BOB)).toStrictEqual({ feeds, joined: false, hint: null });
  });
});

describe(startupStream, () => {
  it('makes and shows the stream on a first run', () => {
    expect(startupStream(DEFAULT_SETTINGS, [LAIN])).toStrictEqual({
      patch: { feeds: [LAIN_STREAM], streamMade: true },
      open: LAIN_STREAM,
    });
  });

  it('shows a stream that is still automatic', () => {
    const settings = { ...DEFAULT_SETTINGS, streamMade: true, feeds: [LAIN_STREAM] };

    expect(startupStream(settings, [LAIN])).toStrictEqual({ patch: null, open: LAIN_STREAM });
  });

  it('shows nothing for an edited stream, a deleted one or other feeds', () => {
    const edited = { ...DEFAULT_SETTINGS, feeds: [{ ...LAIN_STREAM, auto: undefined }] };
    const deleted = { ...DEFAULT_SETTINGS, streamMade: true };
    const other = { ...DEFAULT_SETTINGS, feeds: [{ id: 'f1', name: 'main', sources: [] }] };

    for (const settings of [edited, deleted, other]) {
      expect(startupStream(settings, [LAIN])).toStrictEqual({ patch: null, open: null });
    }
  });
});
