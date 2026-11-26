/**
 * Paste and drop onto one pane with a box (WFE-205, WFE-289): the files a paste or a drop
 * carries go to that pane's own {@link ComposerMediaApi.add}, and the event
 * stops there — the shell's window-wide listeners (src/app/useDropAndPaste)
 * never see it, so the files do not also join the command line's pending
 * media. Anything that carries no files, a text paste or a text drag, is left
 * untouched. While a file drag is over the pane `dragging` is true, so the pane
 * can mark itself as the target.
 */

import { useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';

import { carriedFiles, carriesFiles } from '../lib/dropFiles';

/** The handlers to put on the pane, and whether a file drag is over it. */
export type PaneDrop = {
  readonly dragging: boolean;
  readonly onPaste: (event: ClipboardEvent) => void;
  readonly onDragOver: (event: DragEvent) => void;
  readonly onDragLeave: () => void;
  readonly onDrop: (event: DragEvent) => void;
};

/** Pastes and drops of files into a pane, handed to {@link add}. */
export function usePaneDrop(add: (files: readonly File[]) => void): PaneDrop {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    onPaste: (event) => {
      const files = carriedFiles(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        add(files);
      }
    },
    onDragOver: (event) => {
      if (carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        setDragging(true);
      }
    },
    onDragLeave: () => {
      setDragging(false);
    },
    onDrop: (event) => {
      if (carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        add(carriedFiles(event.dataTransfer));
        setDragging(false);
      }
    },
  };
}
