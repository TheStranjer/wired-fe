/**
 * The dialog of one pending card confirmation (WFE-266, WFE-267): the words of
 * its question and, for a mute, the radio group choosing how long. Confirming
 * hands the line on with the chosen duration word appended (forever adds
 * nothing); cancelling hands nothing on. The choice lives here, so it starts
 * at forever on every open. Delete and block are danger-styled; mute is not.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import type { PostConfirmText } from './postConfirmText';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MuteDurations } from '../ui/MuteDurations';

/** What the dialog asks, and what its answers do. */
export type PostConfirmDialogProps = {
  /** Which question: a mute also asks how long. */
  readonly kind: 'delete' | 'block' | 'mute';
  /** The line a confirmation runs, e.g. `/mute a4`. */
  readonly line: string;
  /** The words of the question. */
  readonly text: PostConfirmText;
  /** Called with the full line to run when confirmed. */
  readonly onRun: (line: string) => void;
  /** Called when the dialog is cancelled. */
  readonly onCancel: () => void;
};

/** The confirm dialog of {@link PostConfirmDialogProps.kind}. */
export function PostConfirmDialog(props: PostConfirmDialogProps): JSX.Element {
  const { kind, line, text, onRun, onCancel } = props;
  const [duration, setDuration] = useState('');
  const mute = kind === 'mute';
  return (
    <ConfirmDialog
      confirmLabel={text.confirmLabel}
      danger={!mute}
      message={text.message}
      onCancel={onCancel}
      onConfirm={() => {
        onRun(duration === '' ? line : `${line} ${duration}`);
      }}
      title={text.title}
    >
      {mute ? <MuteDurations onChange={setDuration} value={duration} /> : null}
    </ConfirmDialog>
  );
}
