/**
 * One labelled field of the new-password form: a text or password input
 * wrapped in its label, so the label is its accessible name.
 */
import type { JSX } from 'react';

import styles from './PasswordResetForm.module.css';

/** What a field shows and reports. */
export type PasswordFieldProps = {
  readonly label: string;
  readonly type: 'text' | 'password';
  readonly autoComplete: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

/** A labelled input. */
export function PasswordField(props: PasswordFieldProps): JSX.Element {
  return (
    <label className={styles['label']}>
      <span>{props.label}</span>
      <input
        autoComplete={props.autoComplete}
        className={styles['input']}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        spellCheck={false}
        type={props.type}
        value={props.value}
      />
    </label>
  );
}
