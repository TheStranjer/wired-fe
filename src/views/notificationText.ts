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

import { excerpt } from './notificationExcerpt';
import type { Viewer } from './postView';
import { fullHandle } from '../accounts/handle';
import type { Notification, NotificationKind } from '../api/schemas/notification';
import type { MessageKey } from '../i18n/messages';
import { t } from '../i18n/translate';

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

/**
 * The message {@link key} with the values it names, an absent one as empty
 * text, then its spaces collapsed: a part a notification lacks (no label, no
 * excerpt) leaves no gap in the sentence.
 */
function say(key: MessageKey, values: Readonly<Record<string, string | null>>): string {
  const filled = Object.fromEntries(Object.entries(values).map(([name, v]) => [name, v ?? '']));
  return t(key, filled).replace(/\s+/gu, ' ').trim();
}

/** The poll sentence: the viewer's own poll ended, or one they voted in. */
function pollEnded(s: Sentence): string {
  const own = s.viewer.accountId !== null && s.n.status?.account.id === s.viewer.accountId;
  return say(own ? 'views.notification.poll_own' : 'views.notification.poll_voted', {
    label: bracket(s.label),
  });
}

/** The report sentence: who filed it, who it is about, and the filer's comment. */
function reported(s: Sentence): string {
  const target = s.n.report?.target ?? null;
  const comment = s.n.report?.comment ?? '';
  return say('views.notification.report', {
    actor: s.at,
    target: target === null ? 'none' : `@${fullHandle(target, s.viewer.origin)}`,
    comment: comment === '' ? null : excerpt(comment),
  });
}

/** The sentence a kind speaks about a post: the actor, the label and the post's words. */
function aboutPost(key: MessageKey, s: Sentence, exact: boolean): string {
  return say(key, { actor: s.at, label: bracket(s.label), excerpt: excerpt(s.n.status, exact) });
}

/** The sentence a kind speaks with the actor alone. */
function byActor(key: MessageKey): (s: Sentence) => string {
  return (s) => say(key, { actor: s.at });
}

/** The sentence each normalized kind speaks; `other` names the raw type. */
const SENTENCES: Record<NotificationKind, (s: Sentence) => string> = {
  mention: (s) => aboutPost('views.notification.mention', s, false),
  status: (s) => say('views.notification.status', { actor: s.at, label: bracket(s.label) }),
  reblog: (s) => aboutPost('views.notification.reblog', s, true),
  follow: byActor('views.notification.follow'),
  follow_request: byActor('views.notification.follow_request'),
  favourite: (s) => aboutPost('views.notification.favourite', s, true),
  poll: pollEnded,
  update: (s) => aboutPost('views.notification.update', s, true),
  reaction: (s) =>
    say('views.notification.reaction', {
      actor: s.at,
      emoji: s.n.emoji,
      label: bracket(s.label),
      excerpt: excerpt(s.n.status, true),
    }),
  move: byActor('views.notification.move'),
  quote: (s) => aboutPost('views.notification.quote', s, false),
  quoted_update: byActor('views.notification.quoted_update'),
  sign_up: byActor('views.notification.sign_up'),
  report: reported,
  chat_mention: (s) =>
    say('views.notification.chat_mention', {
      actor: s.at,
      excerpt: excerpt(s.n.chat_message?.content ?? ''),
    }),
  severed_relationships: () => say('views.notification.severed_relationships', {}),
  moderation_warning: () => say('views.notification.moderation_warning', {}),
  annual_report: () => say('views.notification.annual_report', {}),
  other: (s) => say('views.notification.other', { actor: s.at, type: s.n.type }),
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
