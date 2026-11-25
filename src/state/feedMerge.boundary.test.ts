/**
 * Tests for the paging boundary: what is held back until the other sources
 * page past it, and which sources do not count.
 */

import { describe, expect, it } from 'vitest';

import type { FeedCursorState } from './feedItem';
import { blockingSources, mergeItems, oldestBoundary, sourceKey } from './feedMerge';
import { A_HOME, B_HOME, C_LOCAL, ids, post } from '../test/feedItems';

const OPEN = { cursor: { max_id: 'c' }, exhausted: false };
const DONE = { cursor: null, exhausted: true };

/** Cursor state with all three test sources open. */
function allOpen(): FeedCursorState {
  return {
    [sourceKey(A_HOME)]: OPEN,
    [sourceKey(B_HOME)]: OPEN,
    [sourceKey(C_LOCAL)]: OPEN,
  };
}

const ITEMS = mergeItems(
  [post('a1', 50, A_HOME), post('a2', 30, A_HOME)],
  [
    post('b1', 45, B_HOME),
    post('b2', 10, B_HOME),
    post('c1', 40, C_LOCAL),
    post('c2', 35, C_LOCAL),
  ],
);

describe(oldestBoundary, () => {
  it('holds back what is older than the newest oldest-loaded time', () => {
    const { visible, held } = oldestBoundary(ITEMS, allOpen());

    expect(ids(visible)).toStrictEqual(['a1', 'b1', 'c1', 'c2']);
    expect(ids(held)).toStrictEqual(['a2', 'b2']);
  });

  it('shows the held items once the other sources page past them', () => {
    const paged = mergeItems(ITEMS, [post('a3', 8, A_HOME), post('c3', 5, C_LOCAL)]);
    const { visible, held } = oldestBoundary(paged, allOpen());

    expect(ids(visible)).toStrictEqual(['a1', 'b1', 'c1', 'c2', 'a2', 'b2']);
    expect(ids(held)).toStrictEqual(['a3', 'c3']);
  });

  it('ignores exhausted sources for the boundary', () => {
    const cursors = { ...allOpen(), [sourceKey(C_LOCAL)]: DONE };
    const { visible, held } = oldestBoundary(ITEMS, cursors);

    expect(ids(visible)).toStrictEqual(['a1', 'b1', 'c1', 'c2', 'a2']);
    expect(ids(held)).toStrictEqual(['b2']);

    const onlyB = { ...cursors, [sourceKey(A_HOME)]: DONE };

    expect(ids(oldestBoundary(ITEMS, onlyB).held)).toStrictEqual([]);
  });

  it('shows everything when every source is exhausted', () => {
    const cursors = {
      [sourceKey(A_HOME)]: DONE,
      [sourceKey(B_HOME)]: DONE,
      [sourceKey(C_LOCAL)]: DONE,
    };
    const { visible, held } = oldestBoundary(ITEMS, cursors);

    expect(visible).toStrictEqual(ITEMS);
    expect(held).toStrictEqual([]);
  });

  it('shows everything when no source is tracked', () => {
    expect(oldestBoundary(ITEMS, {})).toStrictEqual({ visible: ITEMS, held: [] });
  });

  it('does not let a source with nothing loaded hold the feed back', () => {
    const cursors = { [sourceKey(A_HOME)]: OPEN, [sourceKey(B_HOME)]: OPEN };
    const { visible, held } = oldestBoundary([post('a1', 5, A_HOME)], cursors);

    expect(ids(visible)).toStrictEqual(['a1']);
    expect(held).toStrictEqual([]);
  });

  it('keeps an item exactly at the boundary visible', () => {
    const items = mergeItems(
      [post('a1', 30, A_HOME), post('b1', 30, B_HOME), post('b2', 20, B_HOME)],
      [],
    );
    const cursors = { [sourceKey(A_HOME)]: OPEN, [sourceKey(B_HOME)]: OPEN };
    const { visible, held } = oldestBoundary(items, cursors);

    expect(ids(visible)).toStrictEqual(['a1', 'b1']);
    expect(ids(held)).toStrictEqual(['b2']);
  });
});

describe(blockingSources, () => {
  it('names the open source whose oldest item is the newest of them', () => {
    expect(blockingSources(ITEMS, allOpen())).toStrictEqual([sourceKey(C_LOCAL)]);
  });

  it('names every source tied at the boundary', () => {
    const items = mergeItems([post('a1', 30, A_HOME), post('b1', 30, B_HOME)], []);
    const cursors = { [sourceKey(A_HOME)]: OPEN, [sourceKey(B_HOME)]: OPEN };

    expect(blockingSources(items, cursors)).toStrictEqual([sourceKey(A_HOME), sourceKey(B_HOME)]);
  });

  it('skips exhausted sources, and names nothing when none is open', () => {
    const cursors = { ...allOpen(), [sourceKey(C_LOCAL)]: DONE };

    expect(blockingSources(ITEMS, cursors)).toStrictEqual([sourceKey(A_HOME)]);
    expect(blockingSources(ITEMS, {})).toStrictEqual([]);
  });
});
