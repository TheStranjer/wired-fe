/**
 * The custom emoji list endpoint: `GET /api/v1/custom_emojis` answers the
 * emoji an instance serves, in one unpaginated array. Wired, Mastodon and
 * Pleroma all have it; the shared {@link CustomEmojiSchema} normalizes their
 * shapes onto one model (decision 7), so the emoji picker sees one list.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type CustomEmoji, CustomEmojiSchema } from '../schemas/customEmoji';
import { type ApiSession, sessionRequestData } from '../session';

/** The whole list at once: this endpoint has no page cursors. */
const EmojiListSchema: v.GenericSchema<unknown, readonly CustomEmoji[]> =
  v.array(CustomEmojiSchema);

/**
 * Lists {@link session}'s instance's custom emojis. {@link signal} can cancel
 * the request, which answers the `aborted` error.
 */
export async function listCustomEmojis(
  session: ApiSession,
  signal?: AbortSignal,
): Promise<Result<readonly CustomEmoji[], ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v1/custom_emojis',
    schema: EmojiListSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}
