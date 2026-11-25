/**
 * The sentence a notification prints after its `***` marker (AGENTS.md "Layout":
 * src/views renders every window's lines). One {@link Notification} and the
 * label its status carries in this window come in, the plain words of the line
 * come out — so the notification line and the command that names posts read the
 * same sentence. Pure, like {@link ./postView}: it holds no state and touches no
 * DOM, reusing the one {@link plainText} that flattens hostile remote content.
 * A `mention` with words is spelled like any other line here, but
 * `NotificationLine` shows it as the post itself rather than as this text; a
 * quote gets this sentence and the quoting post under it.
 */

import { excerpt, join } from './notificationExcerpt';
import type { Viewer } from './postView';
import { fullHandle } from '../accounts/handle';
import type { Notification, NotificationKind } from '../api/schemas/notification';

/** `[a3]` for a labelled status; nothing at all for an unlabelled one. */
function bracket(label: string | null): string | null {
  return label === null ? null : `[${label}]`;
}

/** What one sentence is built from: the actor's handle, the label, the item. */
type Sentence = {
  readonly at: string;
  readonly label: string | null;
  readonly n: Notification;
  readonly viewer: Viewer;
};

/** The poll sentence: the viewer's own poll ended, or one they voted in. */
function pollEnded(s: Sentence): string {
  const own = s.viewer.accountId !== null && s.n.status?.account.id === s.viewer.accountId;
  return join([own ? 'a poll you created ended' : 'a poll you voted in ended', bracket(s.label)]);
}

/** The report sentence: who filed it, who it is about, and the filer's comment. */
function reported(s: Sentence): string {
  const target = s.n.report?.target ?? null;
  const against = target === null ? null : `on @${fullHandle(target, s.viewer.origin)}`;
  const comment = s.n.report?.comment ?? '';
  return join([s.at, 'filed a report', against, comment === '' ? null : excerpt(comment)]);
}

/** The sentence each normalized kind speaks; `other` names the raw type. */
const SENTENCES: Record<NotificationKind, (s: Sentence) => string> = {
  mention: (s) => join([s.at, 'mentioned you', bracket(s.label), excerpt(s.n.status)]),
  status: (s) => join([s.at, 'posted', bracket(s.label)]),
  reblog: (s) => join([s.at, 'boosted', bracket(s.label), excerpt(s.n.status, true)]),
  follow: (s) => join([s.at, 'followed you']),
  follow_request: (s) => join([s.at, 'wants to follow you (/accept or /reject coming later)']),
  favourite: (s) => join([s.at, 'favourited', bracket(s.label), excerpt(s.n.status, true)]),
  poll: pollEnded,
  update: (s) => join([s.at, 'edited', bracket(s.label), excerpt(s.n.status, true)]),
  reaction: (s) =>
    join([s.at, 'reacted', s.n.emoji, 'to', bracket(s.label), excerpt(s.n.status, true)]),
  move: (s) => join([s.at, 'moved']),
  quote: (s) => join([s.at, 'quoted', bracket(s.label), excerpt(s.n.status)]),
  quoted_update: (s) => join([s.at, 'edited a post that quotes yours']),
  sign_up: (s) => join([s.at, 'signed up']),
  report: reported,
  chat_mention: (s) =>
    join([s.at, 'sent you a chat message:', excerpt(s.n.chat_message?.content ?? '')]),
  severed_relationships: () => 'a moderation action severed some of your follows or followers',
  moderation_warning: () => 'you received a moderation warning',
  annual_report: () => 'your annual report is ready',
  other: (s) => `${s.at}: ${s.n.type} notification`,
};

/**
 * The words one notification shows, without the leading `***`: the actor as
 * `@handle`, then what they did to the status labelled `label` (or to nothing,
 * for the kinds that carry no status). `viewer` is the window's account: its
 * origin completes a local actor's bare name for {@link fullHandle}, and its id
 * tells a poll the viewer created from one they voted in.
 */
export function notificationText(n: Notification, label: string | null, viewer: Viewer): string {
  return SENTENCES[n.kind]({ at: `@${fullHandle(n.account, viewer.origin)}`, label, n, viewer });
}
