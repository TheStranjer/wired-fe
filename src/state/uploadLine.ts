/**
 * One file going up as a line of somebody's media (WFE-205, WFE-287): the
 * composer panes and the command line's tray share it. The line is added as
 * `uploading` under the given owner (a composer's window id, or
 * `COMMAND_LINE_MEDIA`), the file goes up as the owner's account through
 * {@link uploadAttachment}, and the line becomes `ready` with its thumbnail or
 * `failed` with the reason. The alt text it went up with is remembered on the
 * line, so the post only describes it again if the reader edited it since.
 */

import type { AppState } from './appState';
import { failedPatch, readyPatch, uploadingMedia } from './composerMedia';
import type { Dispatch } from './StateContext';
import { type MediaAttachment, uploadAttachment } from './uploadAttachment';
import type { Result } from '../lib/result';

/** What an upload needs of its owner: the session, where it dispatches, whose media, which account. */
export type UploadEnv = {
  readonly state: AppState;
  readonly dispatch: Dispatch;
  /** A composer's window id, or the reserved key of the command line's media. */
  readonly windowId: string;
  readonly accountKey: string | null;
};

/**
 * Put {@link file} up as a line of the owner's media, described as
 * {@link description}, and settle the line with the answer. The answer comes
 * back too, for whoever wants to say it.
 */
export async function uploadLine(
  env: UploadEnv,
  file: File,
  description: string,
): Promise<Result<MediaAttachment, string>> {
  const { state, dispatch, windowId, accountKey } = env;
  const key = crypto.randomUUID();
  const item = { ...uploadingMedia(key, file.name), description, sent: description };
  dispatch({ type: 'composerMediaAdd', windowId, item });
  const outcome = await uploadAttachment({ state, accountKey, file, description });
  const patch = outcome.ok ? readyPatch(outcome.value) : failedPatch(outcome.error);
  dispatch({ type: 'composerMediaPatch', windowId, key, patch });
  return outcome;
}
