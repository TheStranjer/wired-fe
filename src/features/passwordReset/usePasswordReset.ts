/**
 * The new-password form's state: what the visitor has typed, whether a send
 * is in flight and what the last one came to. The typed passwords are dropped
 * the moment a send succeeds.
 */
import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import type { PasswordResetOutcome, PasswordResetValues } from './submitPasswordReset';

/** The form as it starts: everything empty. */
const EMPTY_VALUES: PasswordResetValues = { instance: '', password: '', confirmation: '' };

/** The form's state and the changes that move it. */
export type PasswordResetState = {
  readonly values: PasswordResetValues;
  readonly sending: boolean;
  /** What the last send came to; null before the first. */
  readonly outcome: PasswordResetOutcome | null;
  readonly set: (name: keyof PasswordResetValues, value: string) => void;
  readonly submit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

/** The form's values, its send in flight and its last outcome, with the changes that move them. */
export function usePasswordReset(
  onSubmit: (values: PasswordResetValues) => Promise<PasswordResetOutcome>,
  instance: string,
): PasswordResetState {
  const [values, setValues] = useState<PasswordResetValues>({ ...EMPTY_VALUES, instance });
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<PasswordResetOutcome | null>(null);

  function set(name: keyof PasswordResetValues, value: string): void {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    const result = await onSubmit(values);
    setSending(false);
    if (result.kind === 'ok') {
      setValues({ ...EMPTY_VALUES, instance });
    }
    setOutcome(result);
  }

  return { values, sending, outcome, set, submit };
}
