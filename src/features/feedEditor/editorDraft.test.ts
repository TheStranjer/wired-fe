/**
 * Tests for the feed editor's draft (decision 14): starting from a feed or
 * from nothing, ticking and unticking sources, reading and adding an
 * account's hashtags, and what is wrong with a name.
 */
import { describe, expect, it } from 'vitest';

import { draftOf, draftProblem, hasSource, tagsOf, toggleSource, withTag } from './editorDraft';
import type { FeedSourceRef, FeedSpec } from '../../state/feeds';

const HOME: FeedSourceRef = { accountKey: 'a', source: 'home' };
const RUST: FeedSourceRef = { accountKey: 'a', source: 'tag:rust' };
const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [HOME, RUST] };

describe(draftOf, () => {
  it('copies the name and sources of a feed', () => {
    expect(draftOf(FEED)).toStrictEqual({ name: 'main', sources: [HOME, RUST] });
  });

  it('is empty for a feed not made yet', () => {
    expect(draftOf(null)).toStrictEqual({ name: '', sources: [] });
  });
});

describe(toggleSource, () => {
  it('ticks a source the draft did not read and unticks one it did', () => {
    const empty = draftOf(null);

    const ticked = toggleSource(empty, HOME);
    const unticked = toggleSource(ticked, HOME);

    expect(ticked.sources).toStrictEqual([HOME]);
    expect(hasSource(ticked, HOME)).toBe(true);
    expect(unticked.sources).toStrictEqual([]);
    expect(hasSource(unticked, HOME)).toBe(false);
  });

  it('tells the same source of another account apart', () => {
    const draft = toggleSource(draftOf(FEED), { accountKey: 'b', source: 'home' });

    expect(draft.sources).toHaveLength(3);
  });
});

describe(tagsOf, () => {
  it('lists the hashtags of one account without the tag: prefix', () => {
    const draft = toggleSource(draftOf(FEED), { accountKey: 'b', source: 'tag:lain' });

    expect(tagsOf(draft, 'a')).toStrictEqual(['rust']);
    expect(tagsOf(draft, 'b')).toStrictEqual(['lain']);
    expect(tagsOf(draft, 'c')).toStrictEqual([]);
  });
});

describe(withTag, () => {
  it('adds a tag, taking off a leading # and the spaces around it', () => {
    const result = withTag(draftOf(null), 'a', '  #rust ');

    expect(result).toStrictEqual({ ok: true, value: { name: '', sources: [RUST] } });
  });

  it('keeps a tag the draft already read once', () => {
    const draft = draftOf(FEED);

    const result = withTag(draft, 'a', 'rust');

    expect(result).toStrictEqual({ ok: true, value: draft });
  });

  it('refuses text that is not a tag name', () => {
    expect(withTag(draftOf(null), 'a', 'two words')).toStrictEqual({
      ok: false,
      error: 'Not a tag: "two words"',
    });
    expect(withTag(draftOf(null), 'a', ' # ')).toStrictEqual({
      ok: false,
      error: 'Not a tag: "#"',
    });
  });
});

describe(draftProblem, () => {
  it('accepts a name of one to 32 characters without spaces', () => {
    expect(draftProblem({ name: 'main', sources: [] })).toBeNull();
  });

  it('refuses an empty name, a long one and one with spaces', () => {
    expect(draftProblem({ name: '  ', sources: [] })).toBe('A feed name is 1-32 characters');
    expect(draftProblem({ name: 'x'.repeat(33), sources: [] })).toBe(
      'A feed name is 1-32 characters',
    );
    expect(draftProblem({ name: 'my feed', sources: [] })).toBe('A feed name has no spaces');
  });
});
