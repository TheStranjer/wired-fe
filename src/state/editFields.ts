/**
 * What an edit re-sends besides the new text: the post's own state. Mastodon's
 * `PUT /api/v1/statuses/<id>` treats absent `media_ids`, `sensitive` and `poll`
 * as "none", so an edit that carried only the text would delete the images and
 * the poll. Sending the current ones keeps them; Wired merges absent fields, so
 * sending them is safe there too. A poll keeps its votes when its options and
 * `multiple` are unchanged, and its expiry is re-sent as the seconds left. It
 * lives in src/state because both `/edit` (src/commands) and the edit composer
 * (src/features/composer, WFE-268) build the request from it.
 */

import type { NewStatus } from '../api/endpoints/statusWrite';
import type { PollLimits } from '../api/schemas/pollLimits';
import type { Status } from '../api/schemas/status';
import { type Result, err, ok } from '../lib/result';

/** What an expired poll hears: Mastodon would reopen it on an edit. */
const POLL_CLOSED = "Can't edit a post whose poll has closed";

/** The fields of an edit other than the text. */
export type EditFields = Omit<NewStatus, 'status' | 'visibility' | 'inReplyToId' | 'quoteId'>;

/** Whole seconds from {@link now} to {@link expiresAt}, at least {@link limits}' minimum. */
function secondsLeft(expiresAt: string | null, now: Date, limits: PollLimits): number {
  if (expiresAt === null) {
    return limits.maxExpiration;
  }
  const left = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000);
  return Math.max(left, limits.minExpiration);
}

/** Whether the poll has closed, by its flag or by its clock. */
function isClosed(poll: NonNullable<Status['poll']>, now: Date): boolean {
  return (
    poll.expired ||
    (poll.expires_at !== null && new Date(poll.expires_at).getTime() <= now.getTime())
  );
}

/**
 * The fields that make an edit of {@link status} keep its media, sensitivity,
 * language and poll, or the refusal when its poll has closed.
 */
export function editFields(
  status: Status,
  limits: PollLimits,
  now: Date,
): Result<EditFields, string> {
  const base: EditFields = {
    spoilerText: status.spoiler_text,
    sensitive: status.sensitive,
    mediaIds: status.media_attachments.map((media) => media.id),
    ...(status.language === null ? {} : { language: status.language }),
  };
  const { poll } = status;
  if (poll === null) {
    return ok(base);
  }
  if (isClosed(poll, now)) {
    return err(POLL_CLOSED);
  }
  return ok({
    ...base,
    poll: {
      options: poll.options.map((option) => option.title),
      multiple: poll.multiple,
      expiresIn: secondsLeft(poll.expires_at, now, limits),
    },
  });
}
