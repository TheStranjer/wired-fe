/**
 * One notification in the scrollback (AGENTS.md "Windows, like IRC buffers").
 * A `mention` is a post aimed at this account, so it is shown as the very row
 * the timeline shows — reused whole from ./PostLine, nick click included —
 * prefixed by a dim `@` so the reader sees, at a glance, that they are in it.
 * Every other kind is a client message: the `***` sentence
 * ./notificationText spells out, on the notification's own clock. Since
 * WFE-106 the actor's handle leads that sentence as a click target, opening
 * their profile window; the kinds whose sentence names no actor stay plain.
 */
import type { JSX } from 'react';

import { hasWords } from './notificationExcerpt';
import styles from './NotificationLine.module.css';
import { notificationText } from './notificationText';
import { PostLine, viewerFor } from './PostLine';
import { fullHandle } from '../accounts/handle';
import type { Status } from '../api/schemas/status';
import type { AppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { labelForStatus } from '../state/bufferSelection';
import { profileWindowOpen } from '../state/profileWindow';
import { bufferFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
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

/** One sentence with its leading actor {@link handle} taken off; null if it has none. */
function withoutActor(sentence: string, handle: string): string | null {
  return sentence.startsWith(`${handle} `) ? sentence.slice(handle.length + 1) : null;
}

/** The post a mention shows as its own row: one with words; none for the rest. */
function mentionedPost(notification: NotificationLineData['notification']): Status | null {
  const { status } = notification;
  return notification.kind === 'mention' && status !== null && hasWords(status) ? status : null;
}

/** The `***` client message of a notification, its actor a click target when it leads. */
function NotificationMessage(props: NotificationLineProps): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { windowId, line } = props;
  const { notification } = line;
  const viewer = viewerFor(state, windowId);
  const sentence = notificationText(
    notification,
    statusLabel(state, windowId, notification),
    viewer,
  );
  const handle = `@${fullHandle(notification.account, viewer.origin)}`;
  const rest = withoutActor(sentence, handle);
  const actor =
    rest === null
      ? undefined
      : {
          handle,
          onSelect: () => {
            dispatch({
              type: 'windows',
              action: profileWindowOpen(notification.account, windowAccountKey(state, windowId)),
            });
          },
        };
  return (
    <SystemLine
      actor={actor}
      clockFormat={state.settings.clockFormat}
      date={new Date(notification.created_at)}
      level="info"
      text={rest ?? sentence}
    />
  );
}

/**
 * One notification line: a mention with words as its post, a quote as its
 * sentence over the quoting post, anything else as a client message.
 */
export function NotificationLine(props: NotificationLineProps): JSX.Element {
  const { notification } = props.line;
  const shown = mentionedPost(notification);
  if (shown !== null) {
    return mentionRow(props, shown);
  }
  if (notification.kind === 'quote' && notification.status !== null) {
    return (
      <>
        <NotificationMessage {...props} />
        {mentionRow(props, notification.status)}
      </>
    );
  }
  return <NotificationMessage {...props} />;
}
