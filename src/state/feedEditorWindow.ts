/**
 * Opening a feed's editor (decision 13 and 14): the window kind `feedEditor`,
 * a GUI for what `/feed new|add|rm|rename|delete` do. Its ref is
 * `{ kind: 'feedEditor', accountKey: null, target: <feed id> }`, or the target
 * `new` for a feed not made yet. Built here in the pure state layer so the
 * `/feed` commands and the views share it. Opening the editor of the same feed
 * twice finds the window that already shows it (src/windows/reducer).
 */

import type { FeedSpec } from './feeds';
import type { WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The target of the editor of a feed that has not been made yet. */
export const NEW_FEED_TARGET = 'new';

/** The title of the editor of {@link feed}, or of a new feed when it is null. */
export function feedEditorTitle(feed: FeedSpec | null): string {
  return feed === null ? 'new feed' : `edit ~${feed.name}`;
}

/** The window-list transition that opens (or activates) the editor of {@link feed}; null is a new feed. */
export function feedEditorOpen(feed: FeedSpec | null): WindowsAction {
  return {
    type: 'open',
    ref: {
      kind: 'feedEditor',
      accountKey: null,
      target: feed === null ? NEW_FEED_TARGET : feed.id,
    },
    title: feedEditorTitle(feed),
  };
}

/** Whether {@link window} is the editor of the feed {@link id}. */
export function editsFeed(window: WindowState, id: string): boolean {
  return window.ref.kind === 'feedEditor' && window.ref.target === id;
}
