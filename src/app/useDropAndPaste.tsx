/**
 * The paste and drop entry points of the shell (WFE-127): files arriving on
 * the window without the `/attach` dialog run onto the WFE-126 seam —
 * {@link Attachments.add} — and non-media files are refused with a warning
 * printed the way a command prints. While a drag carries files the hook hands
 * the caller the full-window {@link DropHighlight} to render; text pastes and
 * text drags are left completely untouched, so the composer behaves as if
 * nothing were wired up. The effect registers the four window listeners once
 * and removes them on cleanup; mounting the hook in Root is a later slice, so
 * callers just render what it returns.
 */

import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { Attachments } from './useAttachments';
import { carriedFiles, carriesFiles, isMedia } from '../lib/dropFiles';
import { printAction } from '../state/appState';
import { type Dispatch, useAppDispatch } from '../state/StateContext';
import { DropHighlight } from '../ui/DropHighlight';

/**
 * Run {@link files} onto the seam: each media file goes to {@link
 * Attachments.add}, each other file comes back as a refusal in the active
 * window, printed the way a command prints.
 */
function accept(files: readonly File[], seam: Pick<Attachments, 'add'>, dispatch: Dispatch): void {
  for (const file of files) {
    if (isMedia(file)) {
      seam.add(file);
    } else {
      dispatch(
        printAction(null, 'warn', `Can't attach ${file.name}: not an image, video or audio file`),
      );
    }
  }
}

/**
 * Listen for pasted and dropped files on the window while mounted, handing
 * every one of them to {@link attachments}' seam. Renders nothing itself:
 * the caller puts up what the hook returns — the {@link DropHighlight} while
 * a file drag is over the window, null the rest of the time.
 */
export function useDropAndPaste(attachments: Pick<Attachments, 'add'>): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [dragging, setDragging] = useState(false);
  const seamRef = useRef(attachments);

  useEffect(() => {
    seamRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent): void {
      const files = carriedFiles(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        accept(files, seamRef.current, dispatch);
      }
    }
    function onDragOver(event: DragEvent): void {
      if (carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        setDragging(true);
      }
    }
    function onDragLeave(): void {
      setDragging(false);
    }
    function onDrop(event: DragEvent): void {
      if (carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        accept(carriedFiles(event.dataTransfer), seamRef.current, dispatch);
        setDragging(false);
      }
    }
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [dispatch]);

  return dragging ? <DropHighlight /> : null;
}
