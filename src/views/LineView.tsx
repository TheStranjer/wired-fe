/**
 * One line of a window's scrollback, whatever it holds (AGENTS.md "Layout":
 * src/views is the rendering shared by every window, because feature slices
 * cannot import each other). The line's kind picks the view: a client message
 * prints as it was stored, a post through the shared ./PostLine row, and a
 * notification through ./NotificationLine — a mention as a post, the rest as a
 * `***` sentence. Nothing here holds state or maps an entity: each kind's own
 * view reads the app state it needs and asks the one reducer for the move.
 */
import type { JSX } from 'react';

import { NotificationLine } from './NotificationLine';
import { PostLine } from './PostLine';
import type { LineData, SystemLineData } from '../state/buffer';
import { useAppState } from '../state/StateContext';
import { SystemLine } from '../ui/SystemLine';

/** Props of {@link LineView}: the window a line is shown in, and the line. */
type LineViewProps = {
  readonly windowId: string;
  readonly line: LineData;
};

/** One client message, printed as the buffer stored it. */
function SystemLineView(props: { readonly line: SystemLineData }): JSX.Element {
  const { line } = props;
  const { clockFormat } = useAppState().settings;
  return (
    <SystemLine clockFormat={clockFormat} date={line.date} level={line.level} text={line.text} />
  );
}

/** One scrollback line of any window, drawn by the view its kind asks for. */
export function LineView(props: LineViewProps): JSX.Element {
  const { windowId, line } = props;
  switch (line.kind) {
    case 'system':
      return <SystemLineView line={line} />;
    case 'post':
      return <PostLine lineKey={line.key} status={line.status} windowId={windowId} />;
    case 'notification':
      return <NotificationLine line={line} windowId={windowId} />;
  }
}
