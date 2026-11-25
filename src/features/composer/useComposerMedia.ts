/**
 * The attachments of one composer window (WFE-205): the entry points the pane
 * offers — the attach button's file input, a paste, a drop — all end in {@link
 * ComposerMediaApi.add}, which adds a line to this window's own media
 * (src/state/composerMedia), so two composers never share a file and the
 * command line's pending media (src/app/useAttachments) is left alone. The
 * command line's `/attach` while a composer is focused ends in {@link
 * ComposerMediaApi.addDescribed}, which does the same with the alt text the
 * command was given (WFE-245). Files go up one by one as the window's account
 * through the state layer's {@link uploadAttachment}; a line shows its upload
 * while it runs, its thumbnail once the instance accepted it, or why it did
 * not. The cap is the account's instance's (decision 5): extras are refused
 * with a warning in the window's own scrollback, before anything is uploaded
 * for them.
 */

import { isMedia } from '../../lib/dropFiles';
import { type AppState, printAction } from '../../state/appState';
import {
  composerMediaOf,
  failedPatch,
  heldCount,
  maxMedia,
  readyPatch,
  uploadingMedia,
} from '../../state/composerMedia';
import type { ComposerMedia } from '../../state/draft';
import { type Dispatch, useAppDispatch, useAppState } from '../../state/StateContext';
import { uploadAttachment } from '../../state/uploadAttachment';

/** What the pane gets of its media: the lines, and the ways to change them. */
export type ComposerMediaApi = {
  readonly items: readonly ComposerMedia[];
  /** Upload each of the files that is media, refusing the rest and any past the cap. */
  readonly add: (files: readonly File[]) => void;
  /** {@link add} with every file described as the second argument says (empty for none). */
  readonly addDescribed: (files: readonly File[], description: string) => void;
  /** Take line {@link key} off the draft. */
  readonly remove: (key: string) => void;
  /** Set the alt text of line {@link key}. */
  readonly describe: (key: string, description: string) => void;
};

/** What an upload needs of its window: the session, where it dispatches, whose composer, which account. */
type UploadEnv = {
  readonly state: AppState;
  readonly dispatch: Dispatch;
  readonly windowId: string;
  readonly accountKey: string | null;
};

/** Put {@link file} up as a line of the window's media, described as {@link description}, and settle the line with the answer. */
async function upload(env: UploadEnv, file: File, description: string): Promise<void> {
  const { state, dispatch, windowId, accountKey } = env;
  const key = crypto.randomUUID();
  const item = { ...uploadingMedia(key, file.name), description };
  dispatch({ type: 'composerMediaAdd', windowId, item });
  const outcome = await uploadAttachment({ state, accountKey, file, description });
  const patch = outcome.ok ? readyPatch(outcome.value) : failedPatch(outcome.error);
  dispatch({ type: 'composerMediaPatch', windowId, key, patch });
}

/** The media of window {@link windowId}'s composer, posting as {@link accountKey}. */
export function useComposerMedia(windowId: string, accountKey: string | null): ComposerMediaApi {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const items = composerMediaOf(state, windowId);

  function warn(text: string): void {
    dispatch(printAction(windowId, 'warn', text));
  }

  function addDescribed(files: readonly File[], description: string): void {
    const max = maxMedia(state, accountKey);
    let held = heldCount(items);
    for (const file of files) {
      if (!isMedia(file)) {
        warn(`Can't attach ${file.name}: not an image, video or audio file`);
      } else if (held >= max) {
        warn(`too many attachments: ${String(max)} per post, skipped ${file.name}`);
      } else {
        held += 1;
        void upload({ state, dispatch, windowId, accountKey }, file, description);
      }
    }
  }

  return {
    items,
    add: (files) => {
      addDescribed(files, '');
    },
    addDescribed,
    remove: (key) => {
      dispatch({ type: 'composerMediaRemove', windowId, key });
    },
    describe: (key, description) => {
      dispatch({ type: 'composerMediaPatch', windowId, key, patch: { description } });
    },
  };
}
