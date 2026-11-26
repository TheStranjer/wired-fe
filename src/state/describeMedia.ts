/**
 * Alt text for a composer's attachments (WFE-205): the reader types it on the
 * attachment's line after the file went up, so just before the post goes out
 * each described attachment gets its text from the account that owns it
 * (`PUT /api/v1/media/:id`, src/api/endpoints/media). Because the app layer may
 * not import api, this is the shell's seam to `updateMedia`. The first refusal
 * stops the run and comes back as the one line to show; an expired token is
 * refreshed the way every write does (./refreshSession).
 */

import type { ComposerMedia } from './draft';
import { withFreshToken } from './refreshSession';
import { accountByKey } from './selectors';
import type { PostContext } from './windowKind';
import { updateMedia } from '../api/endpoints/media';
import { describeApiError } from '../api/errors';
import { t } from '../i18n/translate';

/** A ready attachment line, with the id the instance gave it. */
type Described = ComposerMedia & { readonly mediaId: string };

/**
 * The attachments of {@link media} that wait for a description: ready ones the
 * reader described, other than with the text they already went up with.
 */
function described(media: readonly ComposerMedia[]): readonly Described[] {
  return media.flatMap((item) =>
    item.status === 'ready' &&
    item.mediaId !== null &&
    item.description.trim() !== '' &&
    item.description.trim() !== item.sent?.trim()
      ? [{ ...item, mediaId: item.mediaId }]
      : [],
  );
}

/**
 * Gives every ready attachment of {@link media} its description as the account
 * behind {@link accountKey}. Null when all went through, else the message
 * saying why one did not: no such account, or whatever {@link describeApiError}
 * says of the failure.
 */
export async function describeMedia(
  context: Pick<PostContext, 'state' | 'dispatch' | 'refresh'>,
  accountKey: string | null,
  media: readonly ComposerMedia[],
): Promise<string | null> {
  const { state, dispatch } = context;
  const account = accountByKey(state, accountKey);
  const wanted = described(media);
  if (wanted.length === 0) {
    return null;
  }
  if (account === null) {
    return t('state.not_logged_in');
  }
  const refresh = context.refresh ?? { refresher: null, dispatch, getState: () => state };
  for (const item of wanted) {
    const done = await withFreshToken(
      refresh,
      account.key,
      async (session) => await updateMedia(session, item.mediaId, item.description.trim()),
    );
    if (!done.ok) {
      return describeApiError(done.error);
    }
  }
  return null;
}
