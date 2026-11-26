/**
 * The login box an authorization request opens when nobody is signed in to
 * the instance it names (WFE-168): username and password (and the instance,
 * on a build that does not know its own), sent under the `password` grant.
 * The password lives in this form's state and the one request, never the
 * command line or its history. A refusal shows the instance's message here;
 * success is the parent's business, which then carries on with the request.
 * Sending itself belongs to the layer that renders the box.
 */
import type { JSX } from 'react';

import styles from './AuthorizeBox.module.css';
import { type LoginValues, useLoginForm } from './useLoginForm';
import { preselectedOrigin } from '../../accounts/origin';
import type { PasswordOutcome } from '../../accounts/passwordLogin';
import { useT } from '../../i18n/I18nProvider';
import type { InstanceChoices as Choices } from '../../lib/origin';
import { InstanceChoices } from '../../ui/InstanceChoices';

/** What the form shows and the callbacks it drives. */
export type PasswordLoginFormProps = {
  /** Whether the build leaves the instance to the visitor (a `list` or `open` build). */
  readonly askInstance: boolean;
  /** The instances to pick from (a `list` build with origins); absent: the instance is typed. */
  readonly choices?: Choices | null | undefined;
  /** Send the form; resolves to what came of it. */
  readonly onSubmit: (values: LoginValues) => Promise<PasswordOutcome>;
  /** Close the box, giving up the authorization. */
  readonly onClose: () => void;
};

/** One labelled input of the form. */
function Input(props: {
  readonly label: string;
  readonly type: 'text' | 'password';
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

/** The instance: a choice of the build's instances when it lists any, a text field otherwise. */
function InstanceField(props: {
  readonly choices: Choices | null | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): JSX.Element {
  const { choices } = props;
  const t = useT();
  return choices === null || choices === undefined ? (
    <Input
      autoComplete="url"
      label={t('features.authorize.instance')}
      onChange={props.onChange}
      type="text"
      value={props.value}
    />
  ) : (
    <InstanceChoices {...choices} onChange={props.onChange} value={props.value} />
  );
}

/** What the last send was refused for, if it was. */
function Failure(props: { readonly message: string | null }): JSX.Element | null {
  return props.message === null ? null : (
    <p className={styles['error']} role="alert">
      {props.message}
    </p>
  );
}

/** The send button, off while a send is in flight, and the cancel button. */
function Actions(props: { readonly sending: boolean; readonly onClose: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className={styles['actions']}>
      <button className={styles['button']} disabled={props.sending} type="submit">
        {t('features.authorize.log_in_button')}
      </button>
      <button
        className={styles['button']}
        onClick={() => {
          props.onClose();
        }}
        type="button"
      >
        {t('features.authorize.cancel_button')}
      </button>
    </div>
  );
}

/** The login box: its fields, the failure of the last send, and the send and cancel buttons. */
export function PasswordLoginForm(props: PasswordLoginFormProps): JSX.Element {
  const { choices } = props;
  const t = useT();
  const { values, sending, failure, set, submit } = useLoginForm(
    props.onSubmit,
    preselectedOrigin(choices),
  );
  return (
    <form
      aria-label={t('features.authorize.form_label')}
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <p className={styles['line']}>{t('features.authorize.log_in_intro')}</p>
      {props.askInstance ? (
        <InstanceField choices={choices} onChange={set('instance')} value={values.instance} />
      ) : null}
      <Input
        autoComplete="username"
        label={t('features.authorize.username')}
        onChange={set('username')}
        type="text"
        value={values.username}
      />
      <Input
        autoComplete="current-password"
        label={t('features.authorize.password')}
        onChange={set('password')}
        type="password"
        value={values.password}
      />
      <Failure message={failure} />
      <Actions onClose={props.onClose} sending={sending} />
    </form>
  );
}
