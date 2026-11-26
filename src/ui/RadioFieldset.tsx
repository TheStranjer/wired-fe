/**
 * A labelled single-choice group (WFE-282): native radio buttons in a
 * `<fieldset>` under a `<legend>`, so the arrow keys move through it without
 * any script and assistive technology names the group. The choice itself
 * lives with the caller. Presentational.
 */
import type { JSX } from 'react';

import styles from './RadioFieldset.module.css';

/** One choice: the value it stands for and what the reader sees. */
export type RadioOption = { readonly value: string; readonly label: string };

/** Props of {@link RadioFieldset}. */
export type RadioFieldsetProps = {
  /** The group's name for assistive technology, and its visible heading. */
  readonly legend: string;
  /** The `name` the radios share. */
  readonly name: string;
  readonly options: readonly RadioOption[];
  /** The value of the chosen option. */
  readonly value: string;
  /** Called with the value of the newly chosen option. */
  readonly onChange: (value: string) => void;
};

/** The fieldset of radios. */
export function RadioFieldset(props: RadioFieldsetProps): JSX.Element {
  const { legend, name, options, value, onChange } = props;
  return (
    <fieldset className={styles['group']}>
      <legend className={styles['legend']}>{legend}</legend>
      {options.map((option) => (
        <label className={styles['choice']} key={option.value}>
          <input
            checked={option.value === value}
            name={name}
            onChange={() => {
              onChange(option.value);
            }}
            type="radio"
            value={option.value}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
