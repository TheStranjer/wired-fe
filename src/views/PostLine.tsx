/**
 * One status as one scrollback entry, seen through its window's account
 * (AGENTS.md "Layout": src/views is the rendering shared by every window).
 * `LineView` draws it for a post line and `NotificationLine` reuses it for a
 * mention, so what an ordinary timeline shows and what a notification shows
 * are the very same thing. The window's resolved `density` (decision 15) picks
 * the rendering: a card by default, the IRC row when the setting or the
 * window's own override says `lines`; `avatars` decides whether a card shows
 * pictures. Nothing here holds state: the clock format, the label, the
 * selection and the open content warnings all come from the app state, and a
 * click asks the one reducer for the transition. When the selection moves onto
 * the entry, the view keeps it in view. Clicking the nick opens the author's
 * profile window (WFE-106); a mention or hashtag link in the body opens its
 * profile or tag window the same way (WFE-156, ./openContentLink).
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import { cardName, sharedPostProps, viewerFor, type PostLineTarget } from './postLineProps';
import { postView } from './postView';
import { labelForStatus } from '../state/bufferSelection';
import { bufferFor, displayFor } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { PostCard } from '../ui/PostCard';
import { PostRow } from '../ui/PostRow';

/**
 * Keep an entry the selection just moved onto inside its scrollback, nearest
 * edge so a fully visible one does not jump. jsdom implements no scrollIntoView
 * at all, so the view asks the element whether it has one before calling it.
 */
function scrollRowIntoView(row: HTMLElement | null): void {
  if (row !== null && 'scrollIntoView' in row) {
    row.scrollIntoView({ block: 'nearest' });
  }
}

/** One post: the card or the row its status maps onto, as the window's account sees it. */
export function PostLine(props: PostLineTarget): JSX.Element {
  const { windowId, status } = props;
  const state = useAppState();
  const dispatch = useAppDispatch();
  const buffer = bufferFor(state, windowId);
  const view = postView(status, viewerFor(state, windowId), (id) => labelForStatus(buffer, id));
  const shared = sharedPostProps({ state, go: dispatch }, props, view);
  const rowRef = useRef<HTMLElement | null>(null);
  const { selected } = shared;
  useEffect(() => {
    if (selected) {
      scrollRowIntoView(rowRef.current);
    }
  }, [selected]);
  const display = displayFor(state, windowId);
  if (display.density === 'lines') {
    return <PostRow {...shared} author={view.author} boostedBy={view.boostedBy} ref={rowRef} />;
  }
  const author = { ...view.author, ...cardName(status) };
  return (
    <PostCard
      {...shared}
      author={author}
      boostedBy={view.boostedBy}
      ref={rowRef}
      showAvatar={display.avatars}
    />
  );
}
