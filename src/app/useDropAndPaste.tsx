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
import { useAppDispatch } from '../state/StateContext';
import { DropHighlight } from '../ui/DropHighlight';

/** The media prefixes the seam takes an upload for. */
const MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];

/** The warning line printed for one file outside those prefixes. */
function refusal(file: File): string {
  return `Can't attach ${file.name}: not an image, video or audio file`;
}

/** Whether {@link file} is media the seam takes: an image, a video or audio. */
function isAttachable(file: File): boolean {
  return MEDIA_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

/** The files a clipboard or drop carried; none when it carried nothing. */
function carriedFiles(data: DataTransfer | null | undefined): readonly File[] {
  const files = data?.files;
  return files === undefined ? [] : [...files];
}

/** Whether {@link event}'s drag carries files — the drags this hook reacts to. */
function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/** The four window listeners {@link useDropAndPaste} mounts, and what they do. */
type WindowHandlers = {
  readonly onPaste: (event: ClipboardEvent) => void;
  readonly onDragOver: (event: DragEvent) => void;
  readonly onDragLeave: () => void;
  readonly onDrop: (event: DragEvent) => void;
};

/**
 * Build the window handlers over {@link add}, {@link print} and
 * {@link setDragging}: every carried file goes to the seam when it is media
 * and is refused through {@link print} when it is not. A text paste — or a
 * drag carrying no files — is never consumed: no preventDefault, nothing
 * printed, only a file-carrying dragover raises the highlight.
 */
function makeHandlers(
  add: (file: File) => void,
  print: (text: string) => void,
  setDragging: (up: boolean) => void,
): WindowHandlers {
  function accept(files: readonly File[]): void {
    for (const file of files) {
      if (isAttachable(file)) {
        add(file);
      } else {
        print(refusal(file));
      }
    }
  }
  return {
    onPaste: (event) => {
      const files = carriedFiles(event.clipboardData);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      accept(files);
    },
    onDragOver: (event) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => {
      setDragging(false);
    },
    onDrop: (event) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      accept(carriedFiles(event.dataTransfer));
      setDragging(false);
    },
  };
}

/**
 * Listen for pasted and dropped files on the window while mounted, handing
 * every one of them to {@link attachments}' seam. Renders nothing itself:
 * the caller puts up what the hook returns — the {@link DropHighlight} while
 * a file drag is over the window, null the rest of the time.
 */
export function useDropAndPaste(attachments: Attachments): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [dragging, setDragging] = useState(false);
  const seamRef = useRef(attachments);

  useEffect(() => {
    seamRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    function print(text: string): void {
      dispatch({ type: 'print', windowId: null, date: new Date(), level: 'warn', text });
    }
    const handlers = makeHandlers(
      (file) => {
        seamRef.current.add(file);
      },
      print,
      setDragging,
    );
    window.addEventListener('paste', handlers.onPaste);
    window.addEventListener('dragover', handlers.onDragOver);
    window.addEventListener('dragleave', handlers.onDragLeave);
    window.addEventListener('drop', handlers.onDrop);
    return () => {
      window.removeEventListener('paste', handlers.onPaste);
      window.removeEventListener('dragover', handlers.onDragOver);
      window.removeEventListener('dragleave', handlers.onDragLeave);
      window.removeEventListener('drop', handlers.onDrop);
    };
  }, [dispatch]);

  return dragging ? <DropHighlight /> : null;
}
