/**
 * One labelled field of the sign-up form: a text-like input or the agreement
 * checkbox, wrapped in its label so the label is its accessible name, and
 * the instance's complaints about it, if any, in a paragraph the field is
 * described by.
 */
import { useId } from 'react';
import type { ChangeEvent, JSX } from 'react';

import styles from './RegistrationForm.module.css';

/** What a field shows and reports. */
export type FieldProps = {
  readonly label: string;
  readonly type: 'text' | 'email' | 'password' | 'checkbox';
  readonly value: string | boolean;
  readonly onChange: (value: string | boolean) => void;
  readonly errors: readonly string[];
  readonly autoComplete: string;
};

/** The value a change of {@link event}'s input carries: its checked state or its text. */
function changed(event: ChangeEvent<HTMLInputElement>): string | boolean {
  return event.target.type === 'checkbox' ? event.target.checked : event.target.value;
}

/** A labelled input, with what the instance said against it under it. */
export function Field(props: FieldProps): JSX.Element {
  const errorId = useId();
  const failed = props.errors.length > 0;
  const checkbox = props.type === 'checkbox';
  return (
    <div className={styles['field']}>
      <label className={checkbox ? styles['checkLabel'] : styles['label']}>
        <span>{props.label}</span>
        <input
          aria-describedby={failed ? errorId : undefined}
          aria-invalid={failed}
          autoComplete={props.autoComplete}
          checked={checkbox ? props.value === true : undefined}
          className={checkbox ? styles['check'] : styles['input']}
          onChange={(event) => {
            props.onChange(changed(event));
          }}
          spellCheck={false}
          type={props.type}
          value={checkbox ? undefined : String(props.value)}
        />
      </label>
      {failed ? (
        <p className={styles['error']} id={errorId}>
          {props.errors.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
