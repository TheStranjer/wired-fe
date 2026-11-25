/**
 * The Notification entity schema (decision 7): one entry in a notifications
 * timeline as Wired reports it; the same schema accepts Mastodon's and
 * Pleroma's renderings. `id`, `type`, `created_at` and `account` are required;
 * `status` and `emoji` default to null, because only some kinds carry them.
 * Notification types differ per backend, so `type` keeps the raw string as
 * sent and `kind` holds the normalized value from a closed set: the known
 * names map to themselves, Pleroma's `pleroma:emoji_reaction` maps to
 * `'reaction'`, Mastodon's `admin.sign_up` to `'sign_up'`, `admin.report` and
 * Pleroma's `pleroma:report` to `'report'`, `pleroma:chat_mention` to
 * `'chat_mention'`, and anything a backend invents maps to `'other'`.
 * `status` is parsed by the Status schema, so a broken status fails the
 * notification rather than being hidden. A report's comment and target
 * account (`report`, Mastodon's and Pleroma's spellings alike) and a chat
 * message's text (`chat_message`) are kept; other unknown keys, such as
 * Pleroma's `pleroma` block, are dropped.
 */

import * as v from 'valibot';

import type { Account } from './account';
import { AccountSchema } from './account';
import type { Status } from './status';
import { StatusSchema } from './status';

/** What a notification means, once every backend's quirks are folded away. */
export type NotificationKind =
  | 'mention'
  | 'status'
  | 'reblog'
  | 'follow'
  | 'follow_request'
  | 'favourite'
  | 'poll'
  | 'update'
  | 'reaction'
  | 'move'
  | 'quote'
  | 'quoted_update'
  | 'sign_up'
  | 'report'
  | 'chat_mention'
  | 'severed_relationships'
  | 'moderation_warning'
  | 'annual_report'
  | 'other';

/** What a report notification says: the reporter's comment and who was reported. */
type NotificationReport = {
  readonly comment: string;
  readonly target: Account | null;
};

/** The chat message a Pleroma chat-mention notification carries. */
type NotificationChatMessage = {
  readonly content: string;
};

/** A notification on any of the three backends, normalized to Wired's shape. */
export type Notification = {
  readonly id: string;
  /** The type string exactly as the backend sent it. */
  readonly type: string;
  /** The same type, normalized onto the closed kind set. */
  readonly kind: NotificationKind;
  readonly created_at: string;
  readonly account: Account;
  readonly status: Status | null;
  /** The reaction emoji (Pleroma, Wired), null for every other kind. */
  readonly emoji: string | null;
  /** The report (`admin.report`, `pleroma:report`), null for every other kind. */
  readonly report: NotificationReport | null;
  /** The chat message (`pleroma:chat_mention`), null for every other kind. */
  readonly chat_message: NotificationChatMessage | null;
};

/** The raw types WiredFE recognizes; every other string becomes `'other'`. */
const KIND_BY_TYPE: Readonly<Record<string, NotificationKind>> = {
  mention: 'mention',
  status: 'status',
  reblog: 'reblog',
  follow: 'follow',
  follow_request: 'follow_request',
  favourite: 'favourite',
  poll: 'poll',
  update: 'update',
  reaction: 'reaction',
  move: 'move',
  'pleroma:emoji_reaction': 'reaction',
  quote: 'quote',
  quoted_update: 'quoted_update',
  'admin.sign_up': 'sign_up',
  'admin.report': 'report',
  'pleroma:report': 'report',
  'pleroma:chat_mention': 'chat_mention',
  severed_relationships: 'severed_relationships',
  moderation_warning: 'moderation_warning',
  annual_report: 'annual_report',
};

/** Maps a backend's raw notification type onto the closed {@link NotificationKind} set. */
export function notificationKind(type: string): NotificationKind {
  return KIND_BY_TYPE[type] ?? 'other';
}

/** A report on the wire: Mastodon says `comment`/`target_account`, Pleroma `content`/`account`. */
const ReportSchema: v.GenericSchema<unknown, NotificationReport> = v.pipe(
  v.object({
    comment: v.optional(v.nullable(v.string()), null),
    content: v.optional(v.nullable(v.string()), null),
    target_account: v.optional(v.nullable(AccountSchema), null),
    account: v.optional(v.nullable(AccountSchema), null),
  }),
  v.transform((report) => ({
    comment: report.comment ?? report.content ?? '',
    target: report.target_account ?? report.account,
  })),
);

/** A chat message on the wire: only its text is kept; attachment-only is empty. */
const ChatMessageSchema: v.GenericSchema<unknown, NotificationChatMessage> = v.pipe(
  v.object({ content: v.optional(v.nullable(v.string()), null) }),
  v.transform((message) => ({ content: message.content ?? '' })),
);

/** The wire shape shared by all three backends, before the kind is derived. */
const NotificationWireSchema = v.object({
  id: v.string(),
  type: v.string(),
  created_at: v.string(),
  account: AccountSchema,
  status: v.optional(v.nullable(StatusSchema), null),
  emoji: v.optional(v.nullable(v.string()), null),
  report: v.optional(v.nullable(ReportSchema), null),
  chat_message: v.optional(v.nullable(ChatMessageSchema), null),
});

/** Parses any backend's notification into the internal {@link Notification}. */
export const NotificationSchema: v.GenericSchema<unknown, Notification> = v.pipe(
  NotificationWireSchema,
  v.transform((notification) => ({
    ...notification,
    kind: notificationKind(notification.type),
  })),
);
