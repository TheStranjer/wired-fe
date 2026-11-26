/**
 * The box an external login's registration link opens (WFE-169): the provider's
 * details are fetched anonymously when the box opens, prefilled into a nickname
 * and e-mail form (and an optional password), and the send either navigates to
 * the instance's `redirect_uri`, announces that the account awaits approval or
 * e-mail confirmation, or shows the instance's refusal inline. A bad or expired
 * state shows why, with a way out. Needs no signed-in account.
 */
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';

import styles from './External.module.css';
import { describeExternalError } from './outcome';
import { Focused, Input, Message, TextButton } from './Parts';
import { type RegisterForm, type RegisterSetup, useRegisterForm } from './useRegisterForm';
import { type RegistrationDetails, getRegistrationDetails } from '../../api/endpoints/external';
import { useT } from '../../i18n/I18nProvider';

/** What the box needs: the instance, the login's state, and how to leave. */
export type RegisterBoxProps = {
  /** The instance origin the login happened on. */
  readonly origin: string;
  readonly state: string;
  readonly navigate: (url: string) => void;
  /** Close the box. */
  readonly onClose: () => void;
};

/** What the box is waiting for or has: details to fill in, or why there are none. */
type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly details: RegistrationDetails }
  | { readonly kind: 'error'; readonly message: string };

/** The line that says whose details these are. */
function intro(details: RegistrationDetails, t: ReturnType<typeof useT>): string {
  return t('features.external.intro', {
    provider: details.provider === '' ? t('features.external.your_provider') : details.provider,
    named: details.name === '' ? 'no' : 'yes',
    name: details.name,
  });
}

/** The fields, the instance's last refusal and the send and cancel buttons. */
function Fields(props: {
  readonly form: RegisterForm;
  readonly details: RegistrationDetails;
  readonly onClose: () => void;
}): JSX.Element {
  const { values, sending, outcome, set, submit } = props.form;
  const t = useT();
  return (
    <form
      aria-label={t('features.external.form_label')}
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <p className={styles['line']}>{intro(props.details, t)}</p>
      <Input
        autoComplete="username"
        label={t('features.external.nickname')}
        onChange={set('nickname')}
        type="text"
        value={values.nickname}
      />
      <Input
        autoComplete="email"
        label={t('features.external.email')}
        onChange={set('email')}
        type="email"
        value={values.email}
      />
      <Input
        autoComplete="new-password"
        label={t('features.external.password_optional')}
        onChange={set('password')}
        type="password"
        value={values.password}
      />
      {outcome === null ? null : (
        <p className={styles['error']} role="alert">
          {outcome.message}
        </p>
      )}
      <div className={styles['actions']}>
        <TextButton disabled={sending} label={t('features.external.register_button')} submit />
        <TextButton label={t('features.external.cancel_button')} onClick={props.onClose} />
      </div>
    </form>
  );
}

/** The form for the details the provider gave, or what a finished send says. */
function Form(
  props: RegisterSetup & {
    readonly details: RegistrationDetails;
    readonly onClose: () => void;
  },
): JSX.Element {
  const form = useRegisterForm(props, props.details);
  const { outcome } = form;
  if (outcome?.kind === 'finished') {
    return (
      <Focused step="done">
        <Message onClose={props.onClose} role="status" text={outcome.message} />
      </Focused>
    );
  }
  return <Fields details={props.details} form={form} onClose={props.onClose} />;
}

/** The box for {@link props}.phase. */
function Body(props: {
  readonly phase: Phase;
  readonly setup: RegisterSetup;
  readonly onClose: () => void;
}): JSX.Element {
  const { phase, onClose } = props;
  const t = useT();
  switch (phase.kind) {
    case 'loading':
      return (
        <Message
          label={t('features.external.cancel_button')}
          onClose={onClose}
          role="status"
          text={t('features.external.loading_details')}
        />
      );
    case 'error':
      return <Message onClose={onClose} role="alert" text={phase.message} />;
    case 'ready':
      return <Form {...props.setup} details={phase.details} onClose={onClose} />;
  }
}

/** The registration box for one external login. */
export function RegisterBox(props: RegisterBoxProps): JSX.Element {
  const { origin, state, navigate } = props;
  const session = useMemo(() => ({ origin, token: null }), [origin]);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let current = true;
    void getRegistrationDetails(session, state).then((answer) => {
      if (current) {
        setPhase(
          answer.ok
            ? { kind: 'ready', details: answer.value }
            : { kind: 'error', message: describeExternalError(answer.error) },
        );
      }
    });
    return () => {
      current = false;
    };
  }, [session, state]);

  return (
    <Focused step={phase.kind}>
      <Body onClose={props.onClose} phase={phase} setup={{ session, state, navigate }} />
    </Focused>
  );
}
