/**
 * The `[📎]` button at the left edge of the command line (WFE-287): it asks the
 * app to open the file dialog `/attach` opens. Presentational only; what the
 * chosen files become belongs to the app layer.
 */
import type { JSX } from 'react';

import styles from './AttachButton.module.css';
import { useT } from '../i18n/I18nProvider';

/** The paperclip button; {@link props.onAttach} runs when it is clicked. */
export function AttachButton(props: { readonly onAttach: () => void }): JSX.Element {
  const t = useT();
  return (
    <button
      aria-label={t('ui.attach_button.label')}
      className={styles['attach']}
      onClick={props.onAttach}
      type="button"
    >
      <span aria-hidden="true">[📎]</span>
    </button>
  );
}
