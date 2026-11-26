/**
 * The login box's state (WFE-168): what the visitor has typed, whether a send
 * is in flight and what the last refusal said. A send that succeeds leaves the
 * box as it is — the layer that rendered it carries on with the account.
 */
import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import type { PasswordOutcome } from '../../accounts/passwordLogin';

/** What the visitor typed. */
export type LoginValues = {
  readonly instance: string;
  readonly username: string;
  readonly password: string;
};

/** The form's state and the changes that move it. */
export type LoginForm = {
  readonly values: LoginValues;
  readonly sending: boolean;
  /** What the last refusal said; null before one. */
  readonly failure: string | null;
  readonly set: (name: keyof LoginValues) => (value: string) => void;
  readonly submit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

/** The form's values, its send in flight and its last refusal, for a send that goes through {@link send}. */
export function useLoginForm(
  send: (values: LoginValues) => Promise<PasswordOutcome>,
  instance: string,
): LoginForm {
  const [values, setValues] = useState<LoginValues>({ instance, username: '', password: '' });
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = (name: keyof LoginValues) => (value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    const outcome = await send(values);
    if (outcome.kind === 'error') {
      setFailure(outcome.message);
      setSending(false);
    }
  }

  return { values, sending, failure, set, submit };
}
