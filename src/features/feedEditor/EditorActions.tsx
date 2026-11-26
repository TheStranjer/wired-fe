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
import { useT } from '../../i18n/I18nProvider';

/** `[ delete feed ]`, which turns into the question whether to delete it. */
function DeleteControl(props: {
  readonly remove: () => void;
  readonly busy: boolean;
}): JSX.Element {
  const t = useT();
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
        {t('features.feed_editor.delete_button')}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t('features.feed_editor.confirm_delete_label')}>
      {t('features.feed_editor.delete_question')}{' '}
      <button
        type="button"
        className={styles['button']}
        disabled={props.busy}
        onClick={props.remove}
      >
        {t('features.feed_editor.delete_yes')}
      </button>
      <button
        type="button"
        className={styles['button']}
        onClick={() => {
          setConfirming(false);
        }}
      >
        {t('features.feed_editor.cancel_button')}
      </button>
    </div>
  );
}

/** The save and delete buttons of an editor, with the refusal or the confirmation of the last try. */
export function EditorActions(props: { readonly save: EditorSave }): JSX.Element {
  const { save } = props;
  const t = useT();
  return (
    <div className={styles['actions']}>
      <button
        type="button"
        className={styles['button']}
        disabled={save.busy || !save.dirty}
        onClick={save.save}
      >
        {t('features.feed_editor.save_button')}
      </button>
      {save.remove === null ? null : <DeleteControl remove={save.remove} busy={save.busy} />}
      {save.saved ? <p role="status">{t('features.feed_editor.saved')}</p> : null}
      {save.error === null ? null : (
        <p className={styles['error']} role="alert">
          {save.error}
        </p>
      )}
    </div>
  );
}
