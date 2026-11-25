/**
 * One notification in the scrollback (AGENTS.md "Windows, like IRC buffers").
 * A `mention` is a post aimed at this account, so it is shown as the very row
 * the timeline shows — reused whole from ./PostLine, nick click included —
 * prefixed by a dim `@` so the reader sees, at a glance, that they are in it.
 * Every other kind is a client message: the `***` sentence
 * ./notificationText spells out, on the notification's own clock. Since
 * WFE-106 the actor's handle leads that sentence as a click target, opening
 * their profile window; the kinds whose sentence names no actor stay plain.
 * When the window's density is `cards` (decision 15, WFE-233) the notification
 * is drawn by ./NotificationCard instead.
 */
import type { JSX } from 'react';

import { openActor, withoutActor } from './notificationActor';
import { NotificationCard } from './NotificationCard';
import { hasWords } from './notificationExcerpt';
import styles from './NotificationLine.module.css';
import { notificationText } from './notificationText';
import { PostLine } from './PostLine';
import { viewerFor } from './postLineProps';
import { fullHandle } from '../accounts/handle';
import type { Status } from '../api/schemas/status';
import type { AppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { labelForStatus } from '../state/bufferSelection';
import { bufferFor, displayFor } from '../state/selectors';
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
          onSelect: openActor({ state, go: dispatch }, windowId, notification.account),
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
 * One IRC notification line: a mention with words as its post, a quote as its
 * sentence over the quoting post, anything else as a client message.
 */
function IrcNotification(props: NotificationLineProps): JSX.Element {
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

/** One notification: a card or an IRC line, as the window's resolved density says. */
export function NotificationLine(props: NotificationLineProps): JSX.Element {
  const state = useAppState();
  if (displayFor(state, props.windowId).density === 'cards') {
    return <NotificationCard {...props} />;
  }
  return <IrcNotification {...props} />;
}
