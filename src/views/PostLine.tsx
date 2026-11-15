/**
 * One status as one scrollback row, seen through its window's account (AGENTS.md
 * "Layout": src/views is the rendering shared by every window). `LineView` draws
 * it for a post line and `NotificationLine` reuses it for a mention, so the row
 * an ordinary timeline shows and the row a notification shows are the very same
 * thing. Nothing here holds state: the clock format, the label, the selection and
 * the open content warnings all come from the app state, and a click asks the one
 * reducer for the transition. When the selection moves onto the row, the view
 * keeps that row in view.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import { postView, type Viewer } from './postView';
import type { Status } from '../api/schemas/status';
import type { AppState } from '../state/appState';
import { labelForStatus } from '../state/bufferSelection';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { PostRow } from '../ui/PostRow';

/** The viewer of a window's lines: the account it belongs to, or nobody. */
export function viewerFor(state: AppState, windowId: string): Viewer {
  const account = accountByKey(state, windowAccountKey(state, windowId));
  if (account === null) {
    return { origin: '', accountId: null };
  }
  return { origin: account.origin, accountId: account.accountId };
}

/** Nothing yet: a later ticket opens the author's profile window from here. */
function selectAuthor(): void {
  // Opening a window is the window layer's move, which this view does not own.
}

/**
 * Keep a row the selection just moved onto inside its scrollback, nearest edge
 * so a fully visible row does not jump. jsdom implements no scrollIntoView at
 * all, so the view asks the element whether it has one before calling it.
 */
function scrollRowIntoView(row: HTMLElement | null): void {
  if (row !== null && 'scrollIntoView' in row) {
    row.scrollIntoView({ block: 'nearest' });
  }
}

/** Props of {@link PostLine}: the window, the row's own buffer key, the status. */
type PostLineProps = {
  readonly windowId: string;
  readonly lineKey: string;
  readonly status: Status;
};

/** One post: the row its status maps onto, as the window's account sees it. */
export function PostLine(props: PostLineProps): JSX.Element {
  const { windowId, lineKey, status } = props;
  const state = useAppState();
  const dispatch = useAppDispatch();
  const buffer = bufferFor(state, windowId);
  const view = postView(status, viewerFor(state, windowId), (id) => labelForStatus(buffer, id));
  const rowRef = useRef<HTMLElement | null>(null);
  const selected = buffer.selectedKey === lineKey;
  useEffect(() => {
    if (selected) {
      scrollRowIntoView(rowRef.current);
    }
  }, [selected]);
  return (
    <PostRow
      ref={rowRef}
      autoExpand={state.settings.expandMedia}
      author={view.author}
      boostedBy={view.boostedBy}
      clockFormat={state.settings.clockFormat}
      counts={view.counts}
      contentHtml={view.contentHtml}
      date={view.date}
      edited={view.edited}
      label={labelForStatus(buffer, status.id) ?? ''}
      media={view.media}
      mine={view.mine}
      poll={view.poll}
      quote={view.quote}
      reactions={view.reactions}
      replyTo={view.replyTo}
      visibility={view.visibility}
      onSelect={() => {
        dispatch({ type: 'select', windowId, key: lineKey });
      }}
      onSelectAuthor={selectAuthor}
      onToggleReveal={() => {
        dispatch({ type: 'toggleReveal', windowId, key: lineKey });
      }}
      revealed={buffer.revealed.has(lineKey)}
      selected={selected}
      sensitive={view.sensitive}
      spoilerText={view.spoilerText}
    />
  );
}
