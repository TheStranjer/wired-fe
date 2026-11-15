/**
 * One line of a window's scrollback, whatever it holds (AGENTS.md "Layout":
 * src/views is the rendering shared by every window, because feature slices
 * cannot import each other). The line's kind picks the view: a client message
 * prints as it was stored, a post as the row its status maps onto seen through
 * the window's account, and a notification — until its own ticket gives it a
 * view — as a client message naming who did what. Nothing here holds state: the
 * clock format, the label, the selection and the open content warnings all come
 * from the app state, and a click asks the one reducer for the transition.
 */
import type { JSX } from 'react';

import { postView, type Viewer } from './postView';
import { fullHandle } from '../accounts/handle';
import type { AppState } from '../state/appState';
import type { LineData, NotificationLineData, PostLineData, SystemLineData } from '../state/buffer';
import { labelForStatus } from '../state/bufferSelection';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { PostRow } from '../ui/PostRow';
import { SystemLine } from '../ui/SystemLine';

/** Props of {@link LineView}: the window a line is shown in, and the line. */
type LineViewProps = {
  readonly windowId: string;
  readonly line: LineData;
};

/** Props of the two views that read their window's account: line and window. */
type WindowedProps<Line extends LineData> = {
  readonly windowId: string;
  readonly line: Line;
};

/** The viewer of a window's lines: the account it belongs to, or nobody. */
function viewerFor(state: AppState, windowId: string): Viewer {
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

/** One client message, printed as the buffer stored it. */
function SystemLineView(props: { readonly line: SystemLineData }): JSX.Element {
  const { line } = props;
  const { clockFormat } = useAppState().settings;
  return (
    <SystemLine clockFormat={clockFormat} date={line.date} level={line.level} text={line.text} />
  );
}

/**
 * One notification, as a client message until its own view lands: the full
 * handle of the account who did the thing and the type the backend called it.
 */
function NotificationLineView(props: WindowedProps<NotificationLineData>): JSX.Element {
  const { windowId, line } = props;
  const state = useAppState();
  const { notification } = line;
  const { origin } = viewerFor(state, windowId);
  return (
    <SystemLine
      clockFormat={state.settings.clockFormat}
      date={new Date(notification.created_at)}
      level="info"
      text={`@${fullHandle(notification.account, origin)} ${notification.type}`}
    />
  );
}

/** One post: the row its status maps onto, as the window's account sees it. */
function PostLineView(props: WindowedProps<PostLineData>): JSX.Element {
  const { windowId, line } = props;
  const state = useAppState();
  const dispatch = useAppDispatch();
  const buffer = bufferFor(state, windowId);
  const view = postView(line.status, viewerFor(state, windowId));
  return (
    <PostRow
      author={view.author}
      clockFormat={state.settings.clockFormat}
      contentHtml={view.contentHtml}
      date={view.date}
      label={labelForStatus(buffer, line.status.id) ?? ''}
      onSelect={() => {
        dispatch({ type: 'select', windowId, key: line.key });
      }}
      onSelectAuthor={selectAuthor}
      onToggleReveal={() => {
        dispatch({ type: 'toggleReveal', windowId, key: line.key });
      }}
      revealed={buffer.revealed.has(line.key)}
      selected={buffer.selectedKey === line.key}
      spoilerText={view.spoilerText}
    />
  );
}

/** One scrollback line of any window, drawn by the view its kind asks for. */
export function LineView(props: LineViewProps): JSX.Element {
  const { windowId, line } = props;
  switch (line.kind) {
    case 'system':
      return <SystemLineView line={line} />;
    case 'post':
      return <PostLineView line={line} windowId={windowId} />;
    case 'notification':
      return <NotificationLineView line={line} windowId={windowId} />;
  }
}
