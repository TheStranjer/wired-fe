/**
 * The sign-up box an invite link opens: username, e-mail address, password
 * (`new-password`, so a password manager offers to make one; it lives in this
 * form's state and the one request, never the command line or its history),
 * an optional reason and the agreement checkbox, plus the instance on a build
 * that does not know its own. A send that fails shows the instance's message
 * and its complaints under the fields they are about; one that needs the
 * address confirmed or a moderator's approval says so; one that signs the new
 * account in closes the box. Sending itself belongs to the layer that renders
 * the box.
 */
import type { JSX } from 'react';

import { Field } from './Field';
import styles from './RegistrationForm.module.css';
import type { RegistrationValues } from './submitRegistration';
import { EMPTY_VALUES, type RegistrationActions, useRegistration } from './useRegistration';
import type { RegistrationOutcome } from '../../accounts/registerAccount';
import type { FieldErrors } from '../../api/errors';

/** What the form shows and the callbacks it drives. */
export type RegistrationFormProps = RegistrationActions & {
  /** Whether the build leaves the instance to the visitor (a `list` or `open` build). */
  readonly askInstance: boolean;
};

/** One field of the form: which value it edits and how it reads. */
type Spec = {
  readonly name: keyof RegistrationValues;
  readonly label: string;
  readonly type: 'text' | 'email' | 'password' | 'checkbox';
  readonly autoComplete: string;
};

/** The fields in order; the instance one only when the build asks for it. */
const SPECS: readonly Spec[] = [
  { name: 'instance', label: 'Instance', type: 'text', autoComplete: 'url' },
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'reason', label: 'Reason (optional)', type: 'text', autoComplete: 'off' },
  {
    name: 'agreement',
    label: 'I agree to the rules and terms of this instance',
    type: 'checkbox',
    autoComplete: 'off',
  },
];

/** What an account that still needs a step before it works says, by outcome. */
const WAITING: Readonly<Record<'confirmation' | 'approval', string>> = {
  confirmation: 'Account created. Check your email to confirm your address, then log in.',
  approval: 'Account created. It is awaiting approval by a moderator.',
};

/** The complaints about fields the form has none of (an invalid invite token, say), as `name: message`. */
function otherErrors(fields: FieldErrors): readonly string[] {
  const known = new Set(Object.keys(EMPTY_VALUES));
  return Object.entries(fields)
    .filter(([name]) => !known.has(name))
    .flatMap(([name, messages]) => messages.map((message) => `${name}: ${message}`));
}

/** The failure of a send: the instance's message and its complaints about fields the form lacks. */
function Failure(props: { readonly outcome: RegistrationOutcome | null }): JSX.Element | null {
  const { outcome } = props;
  if (outcome?.kind !== 'error') {
    return null;
  }
  return (
    <div className={styles['failure']} role="alert">
      <p className={styles['error']}>{outcome.message}</p>
      {otherErrors(outcome.fields).map((line) => (
        <p className={styles['error']} key={line}>
          {line}
        </p>
      ))}
    </div>
  );
}

/** What a registration that needs a further step says, and the way out. */
function Waiting(props: {
  readonly kind: 'confirmation' | 'approval';
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <div className={styles['form']}>
      <p className={styles['notice']} role="status">
        {WAITING[props.kind]}
      </p>
      <button
        className={styles['button']}
        onClick={() => {
          props.onClose();
        }}
        type="button"
      >
        [ close ]
      </button>
    </div>
  );
}

/** The sign-up box: its fields, the failure of the last send, and the send button. */
export function RegistrationForm(props: RegistrationFormProps): JSX.Element {
  const { values, sending, outcome, set, submit } = useRegistration(props);
  const fields = outcome?.kind === 'error' ? outcome.fields : {};
  if (outcome?.kind === 'confirmation' || outcome?.kind === 'approval') {
    return <Waiting kind={outcome.kind} onClose={props.onClose} />;
  }
  return (
    <form
      aria-label="Register"
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {SPECS.filter((spec) => props.askInstance || spec.name !== 'instance').map((spec) => (
        <Field
          autoComplete={spec.autoComplete}
          errors={fields[spec.name] ?? []}
          key={spec.name}
          label={spec.label}
          onChange={(value) => {
            set(spec.name, value);
          }}
          type={spec.type}
          value={values[spec.name]}
        />
      ))}
      <Failure outcome={outcome} />
      <button className={styles['button']} disabled={sending || !values.agreement} type="submit">
        [ register ]
      </button>
    </form>
  );
}
