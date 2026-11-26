/**
 * Tests for the paste and drop entry point (WFE-127): no Root and no network
 * — a probe component mounts the hook under AppStateProvider over a recording
 * Attachments stub. Pasting media hands every file to the seam and consumes
 * the event; a text paste is left alone. A file drag raises the drop
 * highlight, and leaving or dropping takes it away; dropped media reaches
 * `add` file by file. A non-media file never gets there: it comes back as the
 * refusal warning, printed at level warn in the active window. jsdom carries
 * no clipboard or data transfer, so the events are built with stubbed ones —
 * the same testing-library trick as an input's `files`.
 */
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import type { Attachments } from './useAttachments';
import { useDropAndPaste } from './useDropAndPaste';
import type { AppState } from '../state/appState';
import type { SystemLineData } from '../state/buffer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import { installFakeLocale } from '../test/i18n';
import { STATUS_WINDOW_ID } from '../windows/model';

/** One file named {@link name} with mime type {@link type}. */
function mediaFile(name: string, type: string): File {
  return new File(['data'], name, { type });
}

const IMAGE = mediaFile('cat.png', 'image/png');
const VIDEO = mediaFile('clip.mp4', 'video/mp4');
const AUDIO = mediaFile('hum.mp3', 'audio/mpeg');
const TEXT = mediaFile('notes.txt', 'text/plain');

/** The warning the hook prints for {@link TEXT}. */
const REFUSAL = "Can't attach notes.txt: not an image, video or audio file";

/** The hook under test: renders what it returns and reports the state it saw. */
function Probe(props: {
  readonly attachments: Pick<Attachments, 'add'>;
  readonly report: (state: AppState) => void;
}): JSX.Element | null {
  const state = useAppState();
  const { attachments, report } = props;
  useEffect(() => {
    report(state);
  });
  return useDropAndPaste(attachments);
}

/** What a mounted hook gives its test: the recorded seam, the warnings, unmount. */
type Mounted = {
  readonly add: Mock<(file: File) => void>;
  readonly warns: () => readonly string[];
  readonly unmount: () => void;
};

/** Mount the probe over an empty session with a stub seam. */
function mountHook(): Mounted {
  const add = vi.fn<(file: File) => void>();
  const attachments = { add };
  let captured: AppState | null = null;
  const { unmount } = render(
    <AppStateProvider initial={stateAfter([])}>
      <Probe
        attachments={attachments}
        report={(next: AppState): void => {
          captured = next;
        }}
      />
    </AppStateProvider>,
  );
  function warns(): readonly string[] {
    if (captured === null) {
      throw new Error('the probe never rendered');
    }
    return bufferFor(captured, STATUS_WINDOW_ID)
      .lines.filter(
        (line): line is SystemLineData => line.kind === 'system' && line.level === 'warn',
      )
      .map((line) => line.text);
  }
  return { add, warns, unmount };
}

/** Fire a paste on the window carrying {@link files} (null: no clipboard at all). */
function firePaste(files: readonly File[] | null): Event {
  const init = files === null ? {} : { clipboardData: { files: [...files] } };
  const event = createEvent.paste(window, init);
  fireEvent(window, event);
  return event;
}

/** The dataTransfer stub of a drag: {@link files} when it carries any. */
function dragInit(files: readonly File[] | null): Record<string, unknown> {
  return files === null ? { types: ['text/plain'], files: [] } : { types: ['Files'], files };
}

/** Fire {@link type} on the window over {@link files}; null means no files. */
function fireDrag(type: 'dragOver' | 'dragLeave' | 'drop', files: readonly File[] | null): Event {
  const event = createEvent[type](window, { dataTransfer: dragInit(files) });
  fireEvent(window, event);
  return event;
}

describe(useDropAndPaste, () => {
  it('hands every pasted media file to the seam and consumes the paste', () => {
    const { add } = mountHook();

    const event = firePaste([IMAGE, VIDEO, AUDIO]);

    expect(add.mock.calls.map(([file]) => file)).toStrictEqual([IMAGE, VIDEO, AUDIO]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a text paste completely alone', () => {
    const { add, warns } = mountHook();

    const event = firePaste([]);

    expect(add).not.toHaveBeenCalled();
    expect(warns()).toStrictEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('survives a paste whose event carries no clipboard at all', () => {
    const { add, warns } = mountHook();

    const event = firePaste(null);

    expect(add).not.toHaveBeenCalled();
    expect(warns()).toStrictEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('warns about a pasted non-media file and never reaches the seam', () => {
    const { add, warns } = mountHook();

    firePaste([TEXT]);

    expect(add).not.toHaveBeenCalled();
    expect(warns()).toStrictEqual([REFUSAL]);
  });

  it('raises the drop highlight for a file drag and takes it away on leave', () => {
    mountHook();

    const over = fireDrag('dragOver', [IMAGE]);

    expect(screen.getByText('-- drop to attach --')).toBeInTheDocument();
    expect(over.defaultPrevented).toBe(true);

    fireDrag('dragLeave', [IMAGE]);

    expect(screen.queryByText('-- drop to attach --')).toBeNull();
  });

  it('hides the highlight when the files are dropped', () => {
    const { add } = mountHook();
    fireDrag('dragOver', [IMAGE]);

    const drop = fireDrag('drop', [IMAGE, VIDEO]);

    expect(drop.defaultPrevented).toBe(true);
    expect(add.mock.calls.map(([file]) => file)).toStrictEqual([IMAGE, VIDEO]);
    expect(screen.queryByText('-- drop to attach --')).toBeNull();
  });

  it('refuses the non-media files of a drop, one warning each', () => {
    const { add, warns } = mountHook();

    fireDrag('drop', [TEXT, AUDIO, TEXT]);

    expect(add.mock.calls.map(([file]) => file)).toStrictEqual([AUDIO]);
    expect(warns()).toStrictEqual([REFUSAL, REFUSAL]);
  });

  it('ignores drags and drops that carry no files', () => {
    const { add } = mountHook();

    const over = fireDrag('dragOver', null);
    const drop = fireDrag('drop', null);

    expect(over.defaultPrevented).toBe(false);
    expect(drop.defaultPrevented).toBe(false);
    expect(add).not.toHaveBeenCalled();
    expect(screen.queryByText('-- drop to attach --')).toBeNull();
  });

  it('words the refusal in the language in use', () => {
    installFakeLocale({ app: { attach_refused: 'No {file}!' } });
    const { warns } = mountHook();

    firePaste([TEXT]);

    expect(warns()).toStrictEqual(['No notes.txt!']);
  });

  it('stops listening once unmounted', () => {
    const { add, unmount } = mountHook();
    unmount();

    const event = firePaste([IMAGE]);
    fireDrag('dragOver', [IMAGE]);

    expect(add).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByText('-- drop to attach --')).toBeNull();
  });
});
