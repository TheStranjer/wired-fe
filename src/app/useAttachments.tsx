/**
 * The pending media of the next post (WFE-126): state Root holds and the seam
 * every entry point runs through. `pick` stores the asked-for alt text and
 * opens the hidden file input Root renders; every chosen file is then uploaded
 * in order as the active account through the state layer's
 * {@link uploadAttachment} — one `uploading` line, then `attached <name>
 * (n/max)` or the reason it failed. The cap is the active account's
 * instance's (decision 5), and files past it are refused with a warning
 * before anything is uploaded for them. `clear` empties the list — the next
 * post that goes through takes the ids with it — and `add` uploads one file
 * without the dialog: the paste and drop entry points of the next ticket call
 * it. The list lives here, not in the app reducer: it is part of an unsent
 * draft, as transient as the composer box next door.
 */

import { useRef, useState } from 'react';
import type { ChangeEvent, JSX, Ref } from 'react';

import { DEFAULT_MAX_MEDIA_ATTACHMENTS, type Capabilities } from '../capabilities/capabilities';
import type { CommandContext, PrintLevel } from '../commands/types';
import { type AppState, printAction } from '../state/appState';
import { capabilitiesFor } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { type MediaAttachment, uploadAttachment } from '../state/uploadAttachment';

/** The list every session and every cleared one starts on. */
const NO_PENDING: readonly MediaAttachment[] = [];

/** What Root gets from {@link useAttachments}: the command-context slice, plus the dialog and the drop-in entry. */
export type Attachments = CommandContext['attachments'] & {
  /** Uploads {@link file} without opening the dialog (the next ticket's paste and drop). */
  readonly add: (file: File) => void;
  /** The hidden file input; Root renders it, {@link CommandContext.attachments.pick} opens it. */
  readonly input: JSX.Element;
};

/** Everything one chosen file list needs to work its way through. */
type UploadRun = {
  /** The files, in the order the dialog reported them. */
  readonly files: readonly File[];
  /** The session they are uploaded into. */
  readonly state: AppState;
  /** The alt text the picker was asked for; empty means none. */
  readonly description: string;
  /** How many attachments already wait. */
  readonly starting: number;
  /** One client message into the active window, the way commands print. */
  readonly print: (text: string, level: PrintLevel) => void;
  /** The attachment the instance accepted, for the pending list. */
  readonly attach: (attachment: MediaAttachment) => void;
};

/** How many attachments a post may carry on the active account's instance. */
function maxFor(state: AppState): number {
  const caps: Capabilities | null = capabilitiesFor(state, state.activeAccountKey);
  return caps?.maxMediaAttachments ?? DEFAULT_MAX_MEDIA_ATTACHMENTS;
}

/** The files the input just reported, as the array the upload loop wants. */
function filesOf(input: HTMLInputElement): readonly File[] {
  return input.files === null ? [] : [...input.files];
}

/**
 * Upload {@link run}'s files one after another, so the printed lines and the
 * counts stay in order: each is refused with a warning once the instance's cap
 * is reached, announced while it goes up, and — when the instance answers —
 * joins the pending list with its `attached` count. A failure prints what
 * the instance said and the loop moves on to the rest.
 */
async function uploadChosen(run: UploadRun): Promise<void> {
  let attached = run.starting;
  for (const file of run.files) {
    const max = maxFor(run.state);
    if (attached >= max) {
      run.print(`too many attachments: ${String(max)} per post, skipped ${file.name}`, 'warn');
      continue;
    }
    run.print(`uploading ${file.name}…`, 'info');
    const outcome = await uploadAttachment({
      state: run.state,
      accountKey: run.state.activeAccountKey,
      file,
      description: run.description,
    });
    if (!outcome.ok) {
      run.print(outcome.error, 'error');
      continue;
    }
    attached += 1;
    run.attach(outcome.value);
    run.print(`attached ${file.name} (${String(attached)}/${String(max)})`, 'info');
  }
}

/** Props of {@link FilePicker}: where the input lives and what a chosen list does. */
type FilePickerProps = {
  readonly inputRef: Ref<HTMLInputElement>;
  readonly onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** The hidden file input Root renders; the browser's own dialog answers it. */
function FilePicker(props: FilePickerProps): JSX.Element {
  const { inputRef, onFiles } = props;
  return (
    <input
      accept="image/*,video/*,audio/*"
      aria-hidden="true"
      hidden
      multiple
      onChange={onFiles}
      ref={inputRef}
      tabIndex={-1}
      type="file"
    />
  );
}

/**
 * The pending media of this session: call it once in Root, render
 * {@link Attachments.input}, hand the rest into the command context.
 */
export function useAttachments(): Attachments {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState<readonly MediaAttachment[]>(NO_PENDING);
  const altRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  /** Say one line in the active window, the way a command would. */
  function print(text: string, level: PrintLevel): void {
    dispatch(printAction(null, level, text));
  }

  /** Put one accepted attachment at the end of the list. */
  function attach(attachment: MediaAttachment): void {
    setPending((list) => [...list, attachment]);
  }

  /** The uploads for {@link files}, as this session and alt text now stand. */
  function run(files: readonly File[]): UploadRun {
    return { files, state, description: altRef.current, starting: pending.length, print, attach };
  }

  /** What the hidden input answers a chosen file list with. */
  function onFiles(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.currentTarget;
    const chosen = filesOf(input);
    input.value = '';
    void uploadChosen(run(chosen));
  }

  return {
    pick: (description: string) => {
      altRef.current = description.trim();
      inputRef.current?.click();
    },
    clear: () => {
      setPending(NO_PENDING);
    },
    pending,
    add: (file: File) => {
      void uploadChosen(run([file]));
    },
    input: <FilePicker inputRef={inputRef} onFiles={onFiles} />,
  };
}
