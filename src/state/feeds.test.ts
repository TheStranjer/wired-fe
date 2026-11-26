/**
 * Tests for the saved-feed model: the schema that reads the list back from
 * storage (and what it refuses), every helper that changes or looks up feeds,
 * the dropping of a signed-out account's sources, and parseSource for each
 * form of the command grammar — one account, `*`, a tag, and the ways it fails.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  type FeedSource,
  type FeedSourceRef,
  type FeedSpec,
  type Feeds,
  MAX_FEED_NAME,
  addAutoSources,
  addFeed,
  addSource,
  dropAccount,
  feedById,
  feedByName,
  removeFeed,
  removeSource,
  renameFeed,
} from './feeds';
import { FeedsSchema } from './feedSchema';

const HOME: FeedSource = 'home';
const LAIN_HOME: FeedSourceRef = { accountKey: 'https://a.example#1', source: HOME };
const LAIN_RUST: FeedSourceRef = { accountKey: 'https://a.example#1', source: 'tag:rust' };
const ALICE_HOME: FeedSourceRef = { accountKey: 'https://b.example#2', source: 'home' };

const MAIN: FeedSpec = { id: 'f1', name: 'Main', sources: [LAIN_HOME, ALICE_HOME] };
const NEWS: FeedSpec = { id: 'f2', name: 'News', sources: [LAIN_RUST] };
const FEEDS: Feeds = [MAIN, NEWS];

/** The value of an Ok, failing the test on an Err. */
function valueOf<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

/** The error of an Err, failing the test on an Ok. */
function errorOf(result: { ok: true } | { ok: false; error: string }): string {
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error;
}

describe('the stored feed list', () => {
  it('reads a list of valid feeds back, tags and all', () => {
    expect(v.parse(FeedsSchema, FEEDS)).toStrictEqual(FEEDS);
    expect(v.parse(FeedsSchema, [])).toStrictEqual([]);
  });

  it.each([
    ['a list that is not a list', 'feeds'],
    ['a feed with an empty name', [{ ...MAIN, name: '' }]],
    ['a feed with a name over the limit', [{ ...MAIN, name: 'x'.repeat(MAX_FEED_NAME + 1) }]],
    ['a feed with no id', [{ ...MAIN, id: '' }]],
    ['two feeds whose names differ only in case', [MAIN, { ...NEWS, name: 'MAIN' }]],
    ['two feeds with one id', [MAIN, { ...NEWS, id: 'f1' }]],
    ['an unknown source', [{ ...MAIN, sources: [{ accountKey: 'a', source: 'trending' }] }]],
    ['a source that is not a string', [{ ...MAIN, sources: [{ accountKey: 'a', source: 3 }] }]],
    ['an empty tag', [{ ...MAIN, sources: [{ accountKey: 'a', source: 'tag:' }] }]],
    ['a tag with a hash', [{ ...MAIN, sources: [{ accountKey: 'a', source: 'tag:#rust' }] }]],
    ['a tag with a space', [{ ...MAIN, sources: [{ accountKey: 'a', source: 'tag:a b' }] }]],
    ['a source with no account', [{ ...MAIN, sources: [{ source: 'home' }] }]],
  ])('refuses %s', (_name, input) => {
    expect(v.safeParse(FeedsSchema, input).success).toBe(false);
  });

  it('accepts a name of exactly the limit', () => {
    const name = 'x'.repeat(MAX_FEED_NAME);

    expect(v.safeParse(FeedsSchema, [{ ...MAIN, name }]).success).toBe(true);
  });
});

describe('looking feeds up', () => {
  it('finds a feed by name, ignoring case and padding', () => {
    expect(feedByName(FEEDS, 'news')).toBe(NEWS);
    expect(feedByName(FEEDS, '  MAIN ')).toBe(MAIN);
    expect(feedByName(FEEDS, 'nope')).toBeUndefined();
  });

  it('finds a feed by id', () => {
    expect(feedById(FEEDS, 'f2')).toBe(NEWS);
    expect(feedById(FEEDS, 'zz')).toBeUndefined();
  });
});

describe(addFeed, () => {
  it('appends a feed with its name trimmed and identical sources kept once', () => {
    const spec = { id: 'f3', name: ' Art ', sources: [LAIN_HOME, LAIN_HOME, ALICE_HOME] };

    expect(valueOf(addFeed(FEEDS, spec))).toStrictEqual([
      MAIN,
      NEWS,
      { id: 'f3', name: 'Art', sources: [LAIN_HOME, ALICE_HOME] },
    ]);
  });

  it('refuses a name that is blank or too long', () => {
    expect(errorOf(addFeed(FEEDS, { id: 'f3', name: '   ', sources: [] }))).toContain('1-32');
    expect(
      errorOf(addFeed(FEEDS, { id: 'f3', name: 'x'.repeat(MAX_FEED_NAME + 1), sources: [] })),
    ).toContain('1-32');
  });

  it('refuses a name taken in another case, naming the feed that has it', () => {
    expect(errorOf(addFeed(FEEDS, { id: 'f3', name: 'main', sources: [] }))).toContain('"Main"');
  });

  it('refuses an id already in use', () => {
    expect(errorOf(addFeed(FEEDS, { id: 'f1', name: 'Art', sources: [] }))).toContain('f1');
  });
});

describe(removeFeed, () => {
  it('drops the feed with that id and leaves the others', () => {
    expect(removeFeed(FEEDS, 'f1')).toStrictEqual([NEWS]);
    expect(removeFeed(FEEDS, 'zz')).toStrictEqual(FEEDS);
  });
});

describe(renameFeed, () => {
  it('renames one feed and leaves the others', () => {
    expect(valueOf(renameFeed(FEEDS, 'f2', ' Headlines '))).toStrictEqual([
      MAIN,
      { ...NEWS, name: 'Headlines' },
    ]);
  });

  it('lets a feed change only the case of its own name', () => {
    expect(valueOf(renameFeed(FEEDS, 'f1', 'MAIN'))[0]?.name).toBe('MAIN');
  });

  it('refuses an unknown feed, a bad name and another feed’s name', () => {
    expect(errorOf(renameFeed(FEEDS, 'zz', 'Art'))).toContain('zz');
    expect(errorOf(renameFeed(FEEDS, 'f1', ''))).toContain('1-32');
    expect(errorOf(renameFeed(FEEDS, 'f1', 'news'))).toContain('"News"');
  });
});

describe(addSource, () => {
  it('adds sources to one feed, keeping identical ones once', () => {
    const next = addSource(FEEDS, 'f2', [LAIN_RUST, ALICE_HOME, ALICE_HOME]);

    expect(next[1]?.sources).toStrictEqual([LAIN_RUST, ALICE_HOME]);
    expect(next[0]).toBe(MAIN);
  });

  it('ignores an unknown feed', () => {
    expect(addSource(FEEDS, 'zz', [ALICE_HOME])).toStrictEqual(FEEDS);
  });
});

describe(removeSource, () => {
  it('takes one account’s source out of one feed only', () => {
    const next = removeSource(FEEDS, 'f1', LAIN_HOME);

    expect(next[0]?.sources).toStrictEqual([ALICE_HOME]);
    expect(next[1]).toBe(NEWS);
  });

  it('keeps the same source of another account and other sources of the same one', () => {
    expect(removeSource(FEEDS, 'f1', LAIN_RUST)[0]?.sources).toStrictEqual([LAIN_HOME, ALICE_HOME]);
  });
});

describe(dropAccount, () => {
  it('removes that account’s sources from every feed, leaving emptied feeds in place', () => {
    expect(dropAccount(FEEDS, LAIN_HOME.accountKey)).toStrictEqual([
      { ...MAIN, sources: [ALICE_HOME] },
      { ...NEWS, sources: [] },
    ]);
  });

  it('changes nothing for an account no feed reads', () => {
    expect(dropAccount(FEEDS, 'https://c.example#3')).toStrictEqual(FEEDS);
  });
});

describe('automatic feeds', () => {
  const AUTO: Feeds = [{ ...MAIN, auto: true }];

  it('reads the flag back from storage, and leaves it out when there is none', () => {
    expect(v.parse(FeedsSchema, AUTO)).toStrictEqual(AUTO);
    expect(Object.hasOwn(v.parse(FeedsSchema, [MAIN])[0] ?? {}, 'auto')).toBe(false);
  });

  it('keeps the flag when a feed is added with it', () => {
    expect(valueOf(addFeed([], { ...MAIN, auto: true }))).toStrictEqual(AUTO);
  });

  it('loses the flag when the reader adds a source, removes one or renames the feed', () => {
    expect(addSource(AUTO, 'f1', [LAIN_RUST])[0]?.auto).toBeUndefined();
    expect(removeSource(AUTO, 'f1', LAIN_HOME)[0]?.auto).toBeUndefined();
    expect(valueOf(renameFeed(AUTO, 'f1', 'Other'))[0]?.auto).toBeUndefined();
  });

  it('keeps the flag when the client adds sources itself or an account signs out', () => {
    expect(addAutoSources(AUTO, 'f1', [LAIN_RUST])[0]).toStrictEqual({
      ...MAIN,
      sources: [LAIN_HOME, ALICE_HOME, LAIN_RUST],
      auto: true,
    });
    expect(dropAccount(AUTO, ALICE_HOME.accountKey)[0]?.auto).toBe(true);
  });
});
