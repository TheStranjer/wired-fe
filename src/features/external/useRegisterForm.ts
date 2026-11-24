/**
 * The external-login sign-up form's state (WFE-169): the nickname and e-mail
 * address the provider gave (editable), an optional password, whether a send
 * is in flight and what the last one came to. The send is anonymous and the
 * answer is settled by ./outcome: the browser is sent on, a wait for a step is
 * announced, or the instance's refusal (a 422's `error`) stays beside the form.
 */
import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import { type Settled, describeExternalError, settleRegistration } from './outcome';
import {
  type ExternalRegisterBody,
  type RegistrationDetails,
  postExternalRegister,
} from '../../api/endpoints/external';
import type { ApiSession } from '../../api/session';

/** What the visitor may edit. */
type RegisterValues = {
  readonly nickname: string;
  readonly email: string;
  readonly password: string;
};

/** What the form needs: who is asking, which login, and how to leave the page. */
export type RegisterSetup = {
  readonly session: ApiSession;
  /** The `state` of the external login this registration finishes. */
  readonly state: string;
  readonly navigate: (url: string) => void;
};

/** The form's state and the changes that move it. */
export type RegisterForm = {
  readonly values: RegisterValues;
  readonly sending: boolean;
  /** What the last send came to; null before the first. */
  readonly outcome: Settled | null;
  readonly set: (name: keyof RegisterValues) => (value: string) => void;
  readonly submit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

/** The request body for {@link values}: trimmed, and with no password unless one was typed. */
function bodyOf(state: string, values: RegisterValues): ExternalRegisterBody {
  return {
    state,
    nickname: values.nickname.trim(),
    email: values.email.trim(),
    ...(values.password === '' ? {} : { password: values.password }),
  };
}

/** The form's values (starting from {@link details}), its send in flight and its last outcome. */
export function useRegisterForm(setup: RegisterSetup, details: RegistrationDetails): RegisterForm {
  const [values, setValues] = useState<RegisterValues>({
    nickname: details.nickname,
    email: details.email,
    password: '',
  });
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Settled | null>(null);

  const set = (name: keyof RegisterValues) => (value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    const answer = await postExternalRegister(setup.session, bodyOf(setup.state, values));
    setOutcome(
      answer.ok
        ? settleRegistration(answer.value, setup.navigate)
        : { kind: 'error', message: describeExternalError(answer.error) },
    );
    setSending(false);
  }

  return { values, sending, outcome, set, submit };
}
