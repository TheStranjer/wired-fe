/**
 * The one way a picked or dropped file becomes a pending media attachment
 * (WFE-126), the way {@link postStatus} is the one way a window sends a draft:
 * the account behind the given key signs the upload, the file keeps its own
 * name on the wire, and an empty alt description is sent as none. Because the
 * app layer may not import api (AGENTS.md "Layout"), this module is the shell's
 * seam to `uploadAndWait`; a failure comes back already worded as the one line
 * to print. {@link MediaAttachment} rides along through the re-export, so the
 * shell can name the shape without reaching into api either.
 */

import type { AppState } from './appState';
import { sessionFor } from './selectors';
import { uploadAndWait } from '../api/endpoints/media';
import { describeApiError } from '../api/errors';
import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';
import { type Result, err, ok } from '../lib/result';

export type { MediaAttachment };

/**
 * Uploads {@link params.file} as the account behind {@link params.accountKey},
 * waiting for the instance to finish processing it, with
 * {@link params.description} as its alt text when one was given. The attachment
 * the instance accepted, or the message saying why nothing came of it: no
 * session at all, or whatever {@link describeApiError} says of the failure.
 */
export async function uploadAttachment(params: {
  readonly state: AppState;
  readonly accountKey: string | null;
  readonly file: File;
  readonly description: string;
}): Promise<Result<MediaAttachment, string>> {
  const session = sessionFor(params.state, params.accountKey);
  if (session === null) {
    return err(NOT_LOGGED_IN_MESSAGE);
  }
  const outcome = await uploadAndWait(session, params.file, {
    filename: params.file.name,
    ...(params.description === '' ? {} : { description: params.description }),
  });
  return outcome.ok ? ok(outcome.value) : err(describeApiError(outcome.error));
}
