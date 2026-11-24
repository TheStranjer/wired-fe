/**
 * The few pieces both external-login boxes are made of (WFE-169): a plain
 * text button, a labelled input, and a line of text with the way out under it.
 */
import { useEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import styles from './External.module.css';

/**
 * Hands focus to the first field or button of {@link props}.children each time
 * {@link props}.step changes: a step swaps the controls under the focused one,
 * and the dialog's keyboard (Escape included) only works while focus is inside.
 */
export function Focused(props: {
  readonly step: string;
  readonly children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [props.step]);

  return <div ref={ref}>{props.children}</div>;
}

/** A plain text button. */
export function TextButton(props: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly submit?: boolean;
  readonly onClick?: () => void;
}): JSX.Element {
  return (
    <button
      className={styles['button']}
      disabled={props.disabled ?? false}
      onClick={() => {
        props.onClick?.();
      }}
      type={props.submit === true ? 'submit' : 'button'}
    >
      {props.label}
    </button>
  );
}

/** A line of text, as a status or an alert, with the way out under it. */
export function Message(props: {
  readonly role: 'status' | 'alert';
  readonly text: string;
  readonly label?: string;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <div className={styles['box']}>
      <p className={props.role === 'alert' ? styles['error'] : styles['line']} role={props.role}>
        {props.text}
      </p>
      <TextButton label={props.label ?? '[ close ]'} onClick={props.onClose} />
    </div>
  );
}

/** One labelled input of a form. */
export function Input(props: {
  readonly label: string;
  readonly type: 'text' | 'email' | 'password';
  readonly autoComplete: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): JSX.Element {
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
