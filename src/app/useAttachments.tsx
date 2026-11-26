/**
 * The pending media of the next post (WFE-126, WFE-287): app state the tray
 * above the command line shows and the seam every entry point runs through.
 * The media are lines of the composers' media slice under the reserved
 * `COMMAND_LINE_MEDIA` key, so the tray, `describeMedia` and the upload logic
 * are the composer's own. `pick` stores the asked-for alt text and opens the
 * hidden file input Root renders; every chosen file is then uploaded in order
 * (./uploadFiles). `pending` is the ids of the lines the instance accepted,
 * `clear` empties the slice — the next post that goes through takes the ids
 * with it — and `add` uploads one file without the dialog: the paste and drop
 * entry points call it. While a composer window is focused the dialog's files
 * are not pending at all: they go to that composer as its own media, described
 * by the alt text (WFE-245); so are those of a DM or thread window, whose docked
 * box holds media too (WFE-289).
 */

import { useRef } from 'react';
import type { JSX } from 'react';

import { FilePicker } from './FilePicker';
import { type MediaActions, mediaActions } from './mediaActions';
import { showFirstDescription } from './trayFocus';
import { uploadFiles } from './uploadFiles';
import type { CommandContext } from '../commands/types';
import {
  COMMAND_LINE_MEDIA,
  carriesMedia,
  composerMediaOf,
  mediaIdsOf,
} from '../state/composerMedia';
import type { ComposerMedia } from '../state/draft';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { useComposerMedia } from '../views/useComposerMedia';
import { activeWindow } from '../windows/model';

/** What Root gets from {@link useAttachments}: the command-context slice, the lines, and the dialog and drop-in entries. */
export type Attachments = CommandContext['attachments'] &
  MediaActions & {
    /** The lines of the pending media, in the order they were attached: uploading, ready or failed. */
    readonly items: readonly ComposerMedia[];
    /** Uploads {@link file} without opening the dialog (paste and drop). */
    readonly add: (file: File) => void;
    /** Focuses the first alt-text input of the tray (`[+N media]` in the status line). */
    readonly showMedia: () => void;
    /** The hidden file input; Root renders it, {@link CommandContext.attachments.pick} opens it. */
    readonly input: JSX.Element;
  };

/**
 * The pending media of this session: call it once in Root, render
 * {@link Attachments.input}, hand the rest into the command context.
 */
export function useAttachments(): Attachments {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const focused = activeWindow(state.windows);
  const composerMedia = useComposerMedia(focused.id, focused.ref.accountKey);
  const items = composerMediaOf(state, COMMAND_LINE_MEDIA);
  const altRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  /** Upload {@link files} as this session and alt text now stand. */
  function upload(files: readonly File[]): void {
    void uploadFiles(files, { state, dispatch, description: altRef.current });
  }

  /** A focused window with a box of its own (a composer, a DM, a thread) takes the chosen files as its own media; else they wait for the next post. */
  function onFiles(chosen: readonly File[]): void {
    if (carriesMedia(focused.ref.kind)) {
      composerMedia.addDescribed(chosen, altRef.current);
    } else {
      upload(chosen);
    }
  }

  return {
    ...mediaActions(dispatch),
    pick: (description: string) => {
      altRef.current = description.trim();
      inputRef.current?.click();
    },
    pending: mediaIdsOf(items),
    items,
    showMedia: showFirstDescription,
    add: (file: File) => {
      upload([file]);
    },
    input: <FilePicker inputRef={inputRef} onFiles={onFiles} />,
  };
}
