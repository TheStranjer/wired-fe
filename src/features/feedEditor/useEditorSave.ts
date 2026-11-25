/**
 * What the feed editor's `[ save ]` and `[ delete feed ]` do (decision 6 and
 * 14): run `/feed` command lines through the line runner the command line
 * lends (src/views/LineRunnerContext), so command, click and settings stay one
 * path, and show the first refusal where the reader is looking. Saving a new
 * feed also opens it, in the pane the editor was in, and closes the editor.
 */

import { useState } from 'react';

import { type EditorDraft, draftProblem } from './editorDraft';
import { saveLines } from './saveLines';
import type { FeedSpec } from '../../state/feeds';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import { useLineRunner } from '../../views/LineRunnerContext';

/** What the editor knows of its last save. */
type Status = {
  /** The message of the refusal the last save or delete met, or null. */
  readonly error: string | null;
  /** Whether lines are running. */
  readonly busy: boolean;
  /** Whether the last save went through. */
  readonly saved: boolean;
};

/** The state of an editor nothing has been asked of. */
const IDLE: Status = { error: null, busy: false, saved: false };

/** What the editor's buttons are and do. */
export type EditorSave = Status & {
  /** Whether saving would change anything: always for a new feed. */
  readonly dirty: boolean;
  readonly save: () => void;
  /** Delete the feed; null while the feed is not made yet. */
  readonly remove: (() => void) | null;
};

/** What the hook reads of its editor. */
type EditorProps = {
  readonly windowId: string;
  /** The saved feed being edited, or null for a new one. */
  readonly feed: FeedSpec | null;
  readonly draft: EditorDraft;
};

/** The save and delete of the editor {@link props}, over the lines the command line runs. */
export function useEditorSave(props: EditorProps): EditorSave {
  const { windowId, feed, draft } = props;
  const { accounts } = useAppState();
  const dispatch = useAppDispatch();
  const run = useLineRunner();
  const [status, setStatus] = useState<Status>(IDLE);
  const lines = saveLines(feed, draft, accounts);
  const dirty = feed === null || lines.length > 0;

  const settle = (toRun: readonly string[], onOk: () => void): void => {
    setStatus({ ...IDLE, busy: true });
    void run(toRun).then((outcome) => {
      if (outcome.ok) {
        onOk();
      } else {
        setStatus({ ...IDLE, error: outcome.message });
      }
    });
  };
  const save = (): void => {
    const problem = draftProblem(draft);
    if (problem !== null) {
      setStatus({ ...IDLE, error: problem });
    } else if (feed === null) {
      dispatch({ type: 'windows', action: { type: 'activate', id: windowId } });
      settle([...lines, `/feed open ${draft.name.trim()}`], () => {
        dispatch({ type: 'windows', action: { type: 'close', id: windowId } });
      });
    } else {
      settle(lines, () => {
        setStatus({ ...IDLE, saved: true });
      });
    }
  };
  const remove =
    feed === null
      ? null
      : () => {
          settle([`/feed delete ${feed.name}`], () => {
            setStatus(IDLE);
          });
        };
  return { ...status, saved: status.saved && !dirty, dirty, save, remove };
}
