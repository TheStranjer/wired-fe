/**
 * Opening a feed's window (decision 14): the one transition `/feed open`, the
 * view specs and the rename and delete of a feed ask for, built here in the
 * pure state layer so commands and views share it. A feed window belongs to no
 * account — its ref is `{ kind: 'feed', accountKey: null, target: <feed id> }`
 * — and is titled `~<name>`. Opening the same feed twice finds the window that
 * already shows it (src/windows/reducer).
 */

import type { FeedSpec } from './feeds';
import type { WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The title of the window that shows {@link feed}: its name behind a tilde. */
export function feedWindowTitle(feed: FeedSpec): string {
  return `~${feed.name}`;
}

/** The window-list transition that opens (or activates) the window of {@link feed}. */
export function feedWindowOpen(feed: FeedSpec): WindowsAction {
  return {
    type: 'open',
    ref: { kind: 'feed', accountKey: null, target: feed.id },
    title: feedWindowTitle(feed),
  };
}

/** Whether {@link window} shows the feed {@link id}. */
export function showsFeed(window: WindowState, id: string): boolean {
  return window.ref.kind === 'feed' && window.ref.target === id;
}
