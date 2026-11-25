/**
 * Tests for opening a feed's editor (decision 13 and 14): the open transition
 * of a saved feed and of a new one, their titles, and telling the editor of a
 * feed from the windows that show or edit other things.
 */
import { describe, expect, it } from 'vitest';

import { NEW_FEED_TARGET, editsFeed, feedEditorOpen, feedEditorTitle } from './feedEditorWindow';
import type { FeedSpec } from './feeds';
import { type WindowState, windowId } from '../windows/model';

const MAIN: FeedSpec = { id: 'f1', name: 'main', sources: [] };

/** A window with {@link kind} and {@link target}. */
function windowOf(kind: 'feed' | 'feedEditor', target: string): WindowState {
  return {
    id: windowId({ kind, accountKey: null, target }),
    ref: { kind, accountKey: null, target },
    title: 't',
    unread: 0,
    highlight: false,
    display: {},
  };
}

describe(feedEditorOpen, () => {
  it('opens the editor of a saved feed, targeting its id', () => {
    expect(feedEditorOpen(MAIN)).toStrictEqual({
      type: 'open',
      ref: { kind: 'feedEditor', accountKey: null, target: 'f1' },
      title: 'edit ~main',
    });
  });

  it('opens the editor of a new feed, targeting new', () => {
    expect(feedEditorOpen(null)).toStrictEqual({
      type: 'open',
      ref: { kind: 'feedEditor', accountKey: null, target: NEW_FEED_TARGET },
      title: 'new feed',
    });
  });
});

describe(feedEditorTitle, () => {
  it('names the feed edited, or a new feed', () => {
    expect(feedEditorTitle(MAIN)).toBe('edit ~main');
    expect(feedEditorTitle(null)).toBe('new feed');
  });
});

describe(editsFeed, () => {
  it('is true for the editor of that feed alone', () => {
    expect(editsFeed(windowOf('feedEditor', 'f1'), 'f1')).toBe(true);
    expect(editsFeed(windowOf('feedEditor', 'f2'), 'f1')).toBe(false);
    expect(editsFeed(windowOf('feed', 'f1'), 'f1')).toBe(false);
  });
});
