/**
 * Tests for the feed id generator (decision 14): `f1` for no feeds, otherwise
 * one past the largest generated id, ignoring ids of any other shape.
 */
import { describe, expect, it } from 'vitest';

import { nextFeedId } from './feedId';

describe(nextFeedId, () => {
  it('starts at f1', () => {
    expect(nextFeedId([])).toBe('f1');
  });

  it('is one past the largest id made this way, not the count', () => {
    const feeds = [
      { id: 'f2', name: 'a', sources: [] },
      { id: 'f10', name: 'b', sources: [] },
      { id: 'f3', name: 'c', sources: [] },
    ];

    expect(nextFeedId(feeds)).toBe('f11');
  });

  it('ignores ids of another shape', () => {
    expect(nextFeedId([{ id: 'custom', name: 'a', sources: [] }])).toBe('f1');
  });
});
