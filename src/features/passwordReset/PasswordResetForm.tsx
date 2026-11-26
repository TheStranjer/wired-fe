/**
 * The new-password box a reset letter's link opens: two `type=password`
 * fields marked `new-password` (so a password manager offers to make one;
 * they live in this form's state and the one request, never the command line
 * or its history), plus the instance on a build that does not know its own.
 * A mismatch is caught here before anything is sent; a refusal shows the
 * instance's error string; a success says so and offers the way out. Sending
 * itself belongs to the layer that renders the box.
 */
import type { JSX } from 'react';

import { PasswordField } from './PasswordField';
import styles from './PasswordResetForm.module.css';
import type { PasswordResetOutcome, PasswordResetValues } from './submitPasswordReset';
import { usePasswordReset } from './usePasswordReset';
import { preselectedOrigin } from '../../accounts/origin';
import { useT } from '../../i18n/I18nProvider';
import type { InstanceChoices as Choices } from '../../lib/origin';
import { InstanceChoices } from '../../ui/InstanceChoices';

/** What the form shows and the callbacks it drives. */
export type PasswordResetFormProps = {
  /** Whether the build leaves the instance to the visitor (a `list` or `open` build). */
  readonly askInstance: boolean;
  /** The instances to pick from (a `list` build with origins); absent: the instance is typed. */
  readonly choices?: Choices | null | undefined;
  /** Send the form; resolves to what came of it. */
  readonly onSubmit: (values: PasswordResetValues) => Promise<PasswordResetOutcome>;
  /** Close the box. */
  readonly onClose: () => void;
};

/** The failure of the last send, or nothing. */
function Failure(props: { readonly outcome: PasswordResetOutcome | null }): JSX.Element | null {
  const { outcome } = props;
  return outcome?.kind === 'error' ? (
    <p className={styles['error']} role="alert">
      {outcome.message}
    </p>
  ) : null;
}

/** The instance, when the build asks: a choice of its instances when it lists any, a text field otherwise. */
function InstanceField(props: {
  readonly asked: boolean;
  readonly choices: Choices | null | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): JSX.Element | null {
  const { choices } = props;
  const t = useT();
  if (!props.asked) {
    return null;
  }
  return choices === null || choices === undefined ? (
    <PasswordField
      autoComplete="url"
      label={t('features.password_reset.instance')}
      onChange={props.onChange}
      type="text"
      value={props.value}
    />
  ) : (
    <InstanceChoices {...choices} onChange={props.onChange} value={props.value} />
  );
}

/** What a changed password says, and the way out. */
function Done(props: { readonly onClose: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className={styles['form']}>
      <p className={styles['notice']} role="status">
        {t('features.password_reset.done')}
      </p>
      <button
        className={styles['button']}
        onClick={() => {
          props.onClose();
        }}
        type="button"
      >
        {t('features.password_reset.close_button')}
      </button>
    </div>
  );
}

/** The send button, off while a send is in flight. */
function SendButton(props: { readonly sending: boolean }): JSX.Element {
  const t = useT();
  return (
    <button className={styles['button']} disabled={props.sending} type="submit">
      {t('features.password_reset.reset_button')}
    </button>
  );
}

/** The new-password box: its fields, the failure of the last send and the send button. */
export function PasswordResetForm(props: PasswordResetFormProps): JSX.Element {
  const { choices } = props;
  const t = useT();
  const { values, sending, outcome, set, submit } = usePasswordReset(
    props.onSubmit,
    preselectedOrigin(choices),
  );
  if (outcome?.kind === 'ok') {
    return <Done onClose={props.onClose} />;
  }
  return (
    <form
      aria-label={t('features.password_reset.form_label')}
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <InstanceField
        asked={props.askInstance}
        choices={choices}
        onChange={(value) => {
          set('instance', value);
        }}
        value={values.instance}
      />
      <PasswordField
        autoComplete="new-password"
        label={t('features.password_reset.new_password')}
        onChange={(value) => {
          set('password', value);
        }}
        type="password"
        value={values.password}
      />
      <PasswordField
        autoComplete="new-password"
        label={t('features.password_reset.confirm_password')}
        onChange={(value) => {
          set('confirmation', value);
        }}
        type="password"
        value={values.confirmation}
      />
      <Failure outcome={outcome} />
      <SendButton sending={sending} />
    </form>
  );
}
