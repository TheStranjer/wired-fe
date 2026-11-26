/**
 * One notification drawn as a card (decision 15, WFE-233), used when the
 * window's density is `cards`. A mention, reply or quote with a post is a header
 * line (`@ alice mentioned you`) above the post's own card. Every other kind is
 * one compact line: a small avatar (when the window shows avatars), a glyph per
 * kind (★ ⟳ ☰ ✎ ●, the emoji for a reaction), who did what, the clock and, when
 * there is a post, a dim one-line excerpt that opens its thread. The actor's
 * handle is a click target to their profile (WFE-106) wherever the sentence
 * names one. The IRC rendering stays in ./NotificationLine.
 */
import type { JSX } from 'react';

import { openActor, withoutActor } from './notificationActor';
import styles from './NotificationCard.module.css';
import { GLYPHS, VERBS } from './notificationCardWords';
import { excerpt, join } from './notificationExcerpt';
import { notificationText } from './notificationText';
import { PostLine } from './PostLine';
import { viewerFor } from './postLineProps';
import { viaFor } from './via';
import { fullHandle } from '../accounts/handle';
import type { Notification } from '../api/schemas/notification';
import { useLocale } from '../i18n/I18nProvider';
import { t } from '../i18n/translate';
import type { ClickModifiers } from '../lib/clickModifiers';
import type { NotificationLineData } from '../state/buffer';
import { labelForStatus } from '../state/bufferSelection';
import { clickOpen } from '../state/placementFromClick';
import { bufferFor, displayFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { threadWindowOpen } from '../state/threadWindow';
import { Avatar } from '../ui/Avatar';
import { onMiddleClick } from '../ui/middleClick';
import { Timestamp } from '../ui/Timestamp';
import { ViaMark } from '../ui/ViaMark';

/** Props of {@link NotificationCard}: the window the line is shown in, and the line. */
export type NotificationCardProps = {
  readonly windowId: string;
  readonly line: NotificationLineData;
};

/** The words after the glyph, and whether the actor's handle leads them. */
type Entry = { readonly glyph: string; readonly text: string; readonly actor: boolean };

/** What a notification says in a card: its glyph and sentence, from the viewer's side. */
function entryOf(notification: Notification, origin: string): Entry {
  const { kind, status, emoji } = notification;
  const glyph = emoji ?? GLYPHS[kind];
  if (kind === 'mention' && status !== null && status.in_reply_to_id !== null) {
    return { glyph, text: t('views.notification_card.reply'), actor: true };
  }
  const verb = VERBS[kind];
  if (verb !== undefined) {
    return { glyph, text: t(verb), actor: true };
  }
  if (kind === 'poll') {
    return { glyph, text: t('views.notification_card.poll'), actor: false };
  }
  const sentence = notificationText(notification, null, { origin, accountId: null });
  const rest = withoutActor(sentence, `@${fullHandle(notification.account, origin)}`);
  return { glyph, text: rest ?? sentence, actor: rest !== null };
}

/** The `@handle` that leads a sentence: a button asking for the actor's profile window. */
function ActorButton(props: {
  readonly handle: string;
  readonly open: (click: ClickModifiers) => void;
}): JSX.Element {
  return (
    <button
      className={styles['actor']}
      onAuxClick={onMiddleClick(props.open)}
      onClick={props.open}
      type="button"
    >{`@${props.handle}`}</button>
  );
}

/**
 * The notification's header: avatar, glyph, who did what, the account of a
 * multi-account feed it came through when `marked`, and the clock.
 */
function Header(props: NotificationCardProps & { readonly marked: boolean }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { windowId, line, marked } = props;
  const via = marked ? viaFor(state, windowId, line.key) : null;
  const { account, created_at: createdAt } = line.notification;
  const origin = viewerFor(state, windowId).origin;
  const entry = entryOf(line.notification, origin);
  const handle = fullHandle(account, origin);
  return (
    <div className={styles['header']}>
      {displayFor(state, windowId).avatars ? (
        <Avatar
          animate={false}
          handle={`@${handle}`}
          size="small"
          src={account.avatar}
          staticSrc={account.avatar_static}
        />
      ) : undefined}
      <span aria-hidden="true" className={styles['glyph']}>
        {entry.glyph}
      </span>
      <span className={styles['text']}>
        {entry.actor ? (
          <ActorButton
            handle={handle}
            open={openActor({ state, go: dispatch }, windowId, account)}
          />
        ) : undefined}
        {entry.actor ? ' ' : undefined}
        {entry.text}
      </span>
      {via === null ? undefined : <ViaMark via={via} form="card" />}
      <Timestamp date={new Date(createdAt)} format={state.settings.clockFormat} />
    </div>
  );
}

/** The post's words in one dim line; clicking it opens the post's thread. */
function Excerpt(props: NotificationCardProps): JSX.Element | null {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { windowId, line } = props;
  const { status } = line.notification;
  if (status === null) {
    return null;
  }
  const label = labelForStatus(bufferFor(state, windowId), status.id) ?? status.id;
  const accountKey = windowAccountKey(state, windowId);
  const open = (click: ClickModifiers): void => {
    const thread = threadWindowOpen(status.id, accountKey, label);
    dispatch(clickOpen(state.settings, thread, click));
  };
  return (
    <button
      className={styles['excerpt']}
      onAuxClick={onMiddleClick(open)}
      onClick={open}
      type="button"
    >
      {join([excerpt(status)])}
    </button>
  );
}

/** One notification as a card: a post's own card under a header, or a compact line. */
export function NotificationCard(props: NotificationCardProps): JSX.Element {
  useLocale();
  const { kind, status } = props.line.notification;
  if (status !== null && (kind === 'mention' || kind === 'quote')) {
    return (
      <div>
        <Header {...props} marked={false} />
        <PostLine lineKey={props.line.key} status={status} windowId={props.windowId} />
      </div>
    );
  }
  return (
    <div className={styles['compact']}>
      <Header {...props} marked />
      <Excerpt {...props} />
    </div>
  );
}
