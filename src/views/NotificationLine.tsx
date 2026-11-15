/**
 * One notification in the scrollback (AGENTS.md "Windows, like IRC buffers").
 * A `mention` is a post aimed at this account, so it is shown as the very row
 * the timeline shows — reused whole from ./PostLine — prefixed by a dim `@` so
 * the reader sees, at a glance, that they are in it. Every other kind is a
 * client message: the `***` line ./notificationText spells out, on the
 * notification's own clock. The actor's nick is plain text here, exactly as a
 * timeline row shows it for now; opening the author's profile from either is a
 * later ticket's move, like the window layer's other click targets.
 */
import type { JSX } from 'react';

import styles from './NotificationLine.module.css';
import { notificationText } from './notificationText';
import { PostLine, viewerFor } from './PostLine';
import type { Status } from '../api/schemas/status';
import type { AppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { labelForStatus } from '../state/bufferSelection';
import { bufferFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';
import { SystemLine } from '../ui/SystemLine';

/** Props of {@link NotificationLine}: the window the line is shown in, and the line. */
type NotificationLineProps = {
  readonly windowId: string;
  readonly line: NotificationLineData;
};

/** The label this window gave the notification's own status, or null for none. */
function statusLabel(
  state: AppState,
  windowId: string,
  notification: NotificationLineData['notification'],
): string | null {
  const { status } = notification;
  return status === null ? null : labelForStatus(bufferFor(state, windowId), status.id);
}

/** A mention: the post itself as a timeline row, marked with a dim `@`. */
function mentionRow(props: NotificationLineProps, status: Status): JSX.Element {
  const { windowId, line } = props;
  return (
    <div className={styles['mention']}>
      <span aria-hidden="true" className={styles['marker']}>
        @
      </span>
      <PostLine lineKey={line.key} status={status} windowId={windowId} />
    </div>
  );
}

/** One notification line: a mention as its post, anything else as a client message. */
export function NotificationLine(props: NotificationLineProps): JSX.Element {
  const state = useAppState();
  const { windowId, line } = props;
  const { notification } = line;
  const shown = notification.kind === 'mention' ? notification.status : null;
  if (shown !== null) {
    return mentionRow(props, shown);
  }
  return (
    <SystemLine
      clockFormat={state.settings.clockFormat}
      date={new Date(notification.created_at)}
      level="info"
      text={notificationText(
        notification,
        statusLabel(state, windowId, notification),
        viewerFor(state, windowId).origin,
      )}
    />
  );
}
