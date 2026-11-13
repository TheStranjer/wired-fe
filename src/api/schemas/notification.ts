/**
 * The Notification entity schema (decision 7): one entry in a notifications
 * timeline as Wired reports it; the same schema accepts Mastodon's and
 * Pleroma's renderings. `id`, `type`, `created_at` and `account` are required;
 * `status` and `emoji` default to null, because only some kinds carry them.
 * Notification types differ per backend, so `type` keeps the raw string as
 * sent and `kind` holds the normalized value from a closed set: the known
 * names map to themselves, Pleroma's `pleroma:emoji_reaction` maps to
 * `'reaction'`, and anything a backend invents — `admin.sign_up`,
 * `pleroma:chat_mention`, `severed_relationships` — maps to `'other'`.
 * `status` is parsed by the Status schema, so a broken status fails the
 * notification rather than being hidden. Unknown keys, such as Mastodon's
 * `report` or Pleroma's `pleroma` block, are dropped.
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
  | 'other';

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
};

/** Maps a backend's raw notification type onto the closed {@link NotificationKind} set. */
export function notificationKind(type: string): NotificationKind {
  return KIND_BY_TYPE[type] ?? 'other';
}

/** The wire shape shared by all three backends, before the kind is derived. */
const NotificationWireSchema = v.object({
  id: v.string(),
  type: v.string(),
  created_at: v.string(),
  account: AccountSchema,
  status: v.optional(v.nullable(StatusSchema), null),
  emoji: v.optional(v.nullable(v.string()), null),
});

/** Parses any backend's notification into the internal {@link Notification}. */
export const NotificationSchema: v.GenericSchema<unknown, Notification> = v.pipe(
  NotificationWireSchema,
  v.transform((notification) => ({
    ...notification,
    kind: notificationKind(notification.type),
  })),
);
