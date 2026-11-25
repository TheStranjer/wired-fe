/**
 * The feed editor's buttons (decision 14): `[ save ]`, and for a feed already
 * made `[ delete feed ]`, which asks again in the window — never in a browser
 * dialog — before it deletes. What a refusal or a save says is shown beside
 * them.
 */

import { useState } from 'react';
import type { JSX } from 'react';

import styles from './FeedEditor.module.css';
import type { EditorSave } from './useEditorSave';

/** `[ delete feed ]`, which turns into the question whether to delete it. */
function DeleteControl(props: {
  readonly remove: () => void;
  readonly busy: boolean;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className={styles['button']}
        onClick={() => {
          setConfirming(true);
        }}
      >
        [ delete feed ]
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirm delete feed">
      {'Delete this feed? '}
      <button
        type="button"
        className={styles['button']}
        disabled={props.busy}
        onClick={props.remove}
      >
        [ yes, delete ]
      </button>
      <button
        type="button"
        className={styles['button']}
        onClick={() => {
          setConfirming(false);
        }}
      >
        [ cancel ]
      </button>
    </div>
  );
}

/** The save and delete buttons of an editor, with the refusal or the confirmation of the last try. */
export function EditorActions(props: { readonly save: EditorSave }): JSX.Element {
  const { save } = props;
  return (
    <div className={styles['actions']}>
      <button
        type="button"
        className={styles['button']}
        disabled={save.busy || !save.dirty}
        onClick={save.save}
      >
        [ save ]
      </button>
      {save.remove === null ? null : <DeleteControl remove={save.remove} busy={save.busy} />}
      {save.saved ? <p role="status">Saved</p> : null}
      {save.error === null ? null : (
        <p className={styles['error']} role="alert">
          {save.error}
        </p>
      )}
    </div>
  );
}
