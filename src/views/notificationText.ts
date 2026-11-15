/**
 * The sentence a notification prints after its `***` marker (AGENTS.md "Layout":
 * src/views renders every window's lines). One {@link Notification} and the
 * label its status carries in this window come in, the plain words of the line
 * come out — so the notification line and the command that names posts read the
 * same sentence. Pure, like {@link ./postView}: it holds no state and touches no
 * DOM, reusing the one {@link plainText} that flattens hostile remote content.
 * A `mention` is spelled like any other line here, but `NotificationLine` shows
 * it as the post itself rather than as this text.
 */

import { plainText } from './quoteView';
import { fullHandle } from '../accounts/handle';
import type { Notification, NotificationKind } from '../api/schemas/notification';

/** The most characters of a status's words an excerpt shows; `…` marks a cut. */
const EXCERPT_LIMIT = 60;

/** The `parts` joined by single spaces, the empty and absent ones dropped. */
function join(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== '').join(' ');
}

/** `[a3]` for a labelled status; nothing at all for an unlabelled one. */
function bracket(label: string | null): string | null {
  return label === null ? null : `[${label}]`;
}

/** The notification's own status as one quoted plain-text excerpt. */
function quote(n: Notification): string {
  const text = plainText(n.status?.content ?? '');
  return `"${text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text}"`;
}

/** What one sentence is built from: the actor's handle, the label, the item. */
type Sentence = {
  readonly at: string;
  readonly label: string | null;
  readonly n: Notification;
};

/** The sentence each normalized kind speaks; `mention` and `other` name the raw type. */
const SENTENCES: Record<NotificationKind, (s: Sentence) => string> = {
  mention: (s) => join([s.at, s.n.type]),
  status: (s) => join([s.at, 'posted', bracket(s.label)]),
  reblog: (s) => join([s.at, 'boosted', bracket(s.label), quote(s.n)]),
  follow: (s) => join([s.at, 'followed you']),
  follow_request: (s) => join([s.at, 'wants to follow you (/accept or /reject coming later)']),
  favourite: (s) => join([s.at, 'favourited', bracket(s.label), quote(s.n)]),
  poll: (s) => join(['a poll you voted in ended', bracket(s.label)]),
  update: (s) => join([s.at, 'edited', bracket(s.label), quote(s.n)]),
  reaction: (s) => join([s.at, 'reacted', s.n.emoji, 'to', bracket(s.label), quote(s.n)]),
  move: (s) => join([s.at, 'moved']),
  other: (s) => join([s.at, s.n.type]),
};

/**
 * The words one notification shows, without the leading `***`: the actor as
 * `@handle`, then what they did to the status labelled `label` (or to nothing,
 * for the kinds that carry no status). `origin` is the window's account origin,
 * which {@link fullHandle} needs to complete a local actor's bare name.
 */
export function notificationText(n: Notification, label: string | null, origin: string): string {
  return SENTENCES[n.kind]({ at: `@${fullHandle(n.account, origin)}`, label, n });
}
