/**
 * What reaches a feed window's scrollback (decision 14): a page its loader
 * fetched, and items its accounts' streams delivered. Both are merged into the
 * feed the buffer keeps (./bufferFeed), so the loader and the streams agree on
 * what the feed holds and a re-merge never loses a streamed post. A page also
 * moves the paging of the sources it came from; a streamed item is news, so
 * the lines that really joined are counted for the window's unread tally
 * exactly as for any other window (./bufferUnread). An action naming a closed
 * window changes nothing.
 */

import { putBuffer } from './appReducer';
import type { AppState } from './appState';
import { mergeFeed } from './bufferFeed';
import { addedLines, markArrivals } from './bufferUnread';
import type { FeedCursorState, FeedItem } from './feedItem';

/** What can reach one feed window. */
export type FeedAction =
  | {
      readonly type: 'feed';
      readonly windowId: string;
      readonly items: readonly FeedItem[];
      readonly cursors: FeedCursorState;
    }
  | {
      readonly type: 'feedLive';
      readonly windowId: string;
      readonly items: readonly FeedItem[];
    };

/** The feed window {@link action} names takes what it carries. */
export function applyFeedAction(state: AppState, action: FeedAction): AppState {
  const before = state.buffers.get(action.windowId);
  if (before === undefined) {
    return state;
  }
  const live = action.type === 'feedLive';
  const after = mergeFeed(before, action.items, live ? {} : action.cursors);
  const buffers = putBuffer(state.buffers, action.windowId, after);
  const windows = live
    ? markArrivals(state, action.windowId, addedLines(before, after))
    : state.windows;
  return { ...state, buffers, windows };
}
