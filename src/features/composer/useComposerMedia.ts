/**
 * The attachments of one composer window (WFE-205): the entry points the pane
 * offers — the attach button's file input, a paste, a drop — all end in {@link
 * ComposerMediaApi.add}, which adds a line to this window's own media
 * (src/state/composerMedia), so two composers never share a file and the
 * command line's pending media (src/app/useAttachments) is left alone. Files
 * go up one by one as the window's account through the state layer's
 * {@link uploadAttachment}; a line shows its upload while it runs, its
 * thumbnail once the instance accepted it, or why it did not. The cap is the
 * account's instance's (decision 5): extras are refused with a warning in the
 * window's own scrollback, before anything is uploaded for them.
 */

import { isMedia } from '../../lib/dropFiles';
import { printAction } from '../../state/appState';
import {
  composerMediaOf,
  failedPatch,
  heldCount,
  maxMedia,
  readyPatch,
  uploadingMedia,
} from '../../state/composerMedia';
import type { ComposerMedia } from '../../state/draft';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { uploadAttachment } from '../../state/uploadAttachment';

/** What the pane gets of its media: the lines, and the ways to change them. */
export type ComposerMediaApi = {
  readonly items: readonly ComposerMedia[];
  /** Upload each of the files that is media, refusing the rest and any past the cap. */
  readonly add: (files: readonly File[]) => void;
  /** Take line {@link key} off the draft. */
  readonly remove: (key: string) => void;
  /** Set the alt text of line {@link key}. */
  readonly describe: (key: string, description: string) => void;
};

/** The media of window {@link windowId}'s composer, posting as {@link accountKey}. */
export function useComposerMedia(windowId: string, accountKey: string | null): ComposerMediaApi {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const items = composerMediaOf(state, windowId);

  function warn(text: string): void {
    dispatch(printAction(windowId, 'warn', text));
  }

  async function upload(file: File): Promise<void> {
    const key = crypto.randomUUID();
    dispatch({ type: 'composerMediaAdd', windowId, item: uploadingMedia(key, file.name) });
    const outcome = await uploadAttachment({ state, accountKey, file, description: '' });
    const patch = outcome.ok ? readyPatch(outcome.value) : failedPatch(outcome.error);
    dispatch({ type: 'composerMediaPatch', windowId, key, patch });
  }

  function add(files: readonly File[]): void {
    const max = maxMedia(state, accountKey);
    let held = heldCount(items);
    for (const file of files) {
      if (!isMedia(file)) {
        warn(`Can't attach ${file.name}: not an image, video or audio file`);
      } else if (held >= max) {
        warn(`too many attachments: ${String(max)} per post, skipped ${file.name}`);
      } else {
        held += 1;
        void upload(file);
      }
    }
  }

  return {
    items,
    add,
    remove: (key) => {
      dispatch({ type: 'composerMediaRemove', windowId, key });
    },
    describe: (key, description) => {
      dispatch({ type: 'composerMediaPatch', windowId, key, patch: { description } });
    },
  };
}
