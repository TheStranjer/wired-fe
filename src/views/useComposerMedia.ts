/**
 * The attachments of one box (WFE-205, WFE-289): a composer window, or the docked box of a DM or thread window. The entry points the pane
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

import { t } from '../i18n/translate';
import { isMedia } from '../lib/dropFiles';
import { printAction } from '../state/appState';
import { composerMediaOf, heldCount, maxMedia } from '../state/composerMedia';
import type { ComposerMedia } from '../state/draft';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { uploadLine } from '../state/uploadLine';

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
        warn(t('views.media.not_media', { name: file.name }));
      } else if (held >= max) {
        warn(t('views.media.too_many', { max, name: file.name }));
      } else {
        held += 1;
        void uploadLine({ state, dispatch, windowId, accountKey }, file, description);
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
