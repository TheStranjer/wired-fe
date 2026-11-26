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
import { preselectedOrigin } from '../../accounts/origin';
import type { RegistrationOutcome } from '../../accounts/registerAccount';
import type { FieldErrors } from '../../api/errors';
import { useT } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import type { InstanceChoices as Choices } from '../../lib/origin';
import { InstanceChoices } from '../../ui/InstanceChoices';

/** What the form shows and the callbacks it drives. */
export type RegistrationFormProps = RegistrationActions & {
  /** Whether the build leaves the instance to the visitor (a `list` or `open` build). */
  readonly askInstance: boolean;
  /** The instances to pick from (a `list` build with origins); absent: the instance is typed. */
  readonly choices?: Choices | null | undefined;
};

/** One field of the form: which value it edits and how it reads. */
type Spec = {
  readonly name: keyof RegistrationValues;
  /** The message that is the field's label. */
  readonly label: MessageKey;
  readonly type: 'text' | 'email' | 'password' | 'checkbox';
  readonly autoComplete: string;
};

/** The fields in order; the instance one only when the build asks for it. */
const SPECS: readonly Spec[] = [
  { name: 'instance', label: 'features.registration.instance', type: 'text', autoComplete: 'url' },
  {
    name: 'username',
    label: 'features.registration.username',
    type: 'text',
    autoComplete: 'username',
  },
  { name: 'email', label: 'features.registration.email', type: 'email', autoComplete: 'email' },
  {
    name: 'password',
    label: 'features.registration.password',
    type: 'password',
    autoComplete: 'new-password',
  },
  { name: 'reason', label: 'features.registration.reason', type: 'text', autoComplete: 'off' },
  {
    name: 'agreement',
    label: 'features.registration.agreement',
    type: 'checkbox',
    autoComplete: 'off',
  },
];

/** The message an account that still needs a step before it works says, by outcome. */
const WAITING: Readonly<Record<'confirmation' | 'approval', MessageKey>> = {
  confirmation: 'features.registration.waiting_confirmation',
  approval: 'features.registration.waiting_approval',
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
  const t = useT();
  return (
    <div className={styles['form']}>
      <p className={styles['notice']} role="status">
        {t(WAITING[props.kind])}
      </p>
      <button
        className={styles['button']}
        onClick={() => {
          props.onClose();
        }}
        type="button"
      >
        {t('features.registration.close_button')}
      </button>
    </div>
  );
}

/** The instances to choose from, when the build asks for the instance and lists some. */
function chosenChoices(askInstance: boolean, choices: Choices | null | undefined): Choices | null {
  return askInstance ? (choices ?? null) : null;
}

/** The instance's complaints about fields of {@link outcome}, none unless it is a failure. */
function fieldsOf(outcome: RegistrationOutcome | null): FieldErrors {
  return outcome?.kind === 'error' ? outcome.fields : {};
}

/** Which further step the account in {@link outcome} waits for, if it waits. */
function waitingKind(outcome: RegistrationOutcome | null): 'confirmation' | 'approval' | null {
  return outcome?.kind === 'confirmation' || outcome?.kind === 'approval' ? outcome.kind : null;
}

/** The send button, off while a send is in flight or the agreement is not ticked. */
function SendButton(props: { readonly disabled: boolean }): JSX.Element {
  const t = useT();
  return (
    <button className={styles['button']} disabled={props.disabled} type="submit">
      {t('features.registration.register_button')}
    </button>
  );
}

/** The sign-up box: its fields, the failure of the last send, and the send button. */
export function RegistrationForm(props: RegistrationFormProps): JSX.Element {
  const { choices } = props;
  const t = useT();
  const { values, sending, outcome, set, submit } = useRegistration(
    props,
    preselectedOrigin(choices),
  );
  const chosen = chosenChoices(props.askInstance, choices);
  const typed = props.askInstance && chosen === null;
  const fields = fieldsOf(outcome);
  const waiting = waitingKind(outcome);
  if (waiting !== null) {
    return <Waiting kind={waiting} onClose={props.onClose} />;
  }
  return (
    <form
      aria-label={t('features.registration.form_label')}
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {chosen === null ? null : (
        <InstanceChoices
          {...chosen}
          onChange={(value) => {
            set('instance', value);
          }}
          value={values.instance}
        />
      )}
      {SPECS.filter((spec) => typed || spec.name !== 'instance').map((spec) => (
        <Field
          autoComplete={spec.autoComplete}
          errors={fields[spec.name] ?? []}
          key={spec.name}
          label={t(spec.label)}
          onChange={(value) => {
            set(spec.name, value);
          }}
          type={spec.type}
          value={values[spec.name]}
        />
      ))}
      <Failure outcome={outcome} />
      <SendButton disabled={sending || !values.agreement} />
    </form>
  );
}
