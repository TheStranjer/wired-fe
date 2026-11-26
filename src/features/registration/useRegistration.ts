/**
 * The sign-up form's state: what the visitor has typed, whether a send is in
 * flight and what the last one came to. A send that signs the new account in
 * closes the box; any other outcome stays for the form to show.
 */
import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import type { RegistrationValues } from './submitRegistration';
import type { RegistrationOutcome } from '../../accounts/registerAccount';

/** What the form needs from the layer that renders it. */
export type RegistrationActions = {
  /** Send the form; resolves to what came of it. */
  readonly onSubmit: (values: RegistrationValues) => Promise<RegistrationOutcome>;
  /** Close the box. */
  readonly onClose: () => void;
};

/** The form as it starts: everything empty, nothing agreed to. */
export const EMPTY_VALUES: RegistrationValues = {
  instance: '',
  username: '',
  email: '',
  password: '',
  agreement: false,
  reason: '',
};

/** The form's state and the changes that move it. */
export type RegistrationState = {
  readonly values: RegistrationValues;
  readonly sending: boolean;
  /** What the last send came to; null before the first. */
  readonly outcome: RegistrationOutcome | null;
  readonly set: (name: keyof RegistrationValues, value: string | boolean) => void;
  readonly submit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

/** The form's values, its send in flight and its last outcome, with the changes that move them. */
export function useRegistration(actions: RegistrationActions, instance: string): RegistrationState {
  const [values, setValues] = useState<RegistrationValues>({ ...EMPTY_VALUES, instance });
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<RegistrationOutcome | null>(null);

  function set(name: keyof RegistrationValues, value: string | boolean): void {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    const result = await actions.onSubmit(values);
    setSending(false);
    if (result.kind === 'ok') {
      actions.onClose();
      return;
    }
    setOutcome(result);
  }

  return { values, sending, outcome, set, submit };
}
