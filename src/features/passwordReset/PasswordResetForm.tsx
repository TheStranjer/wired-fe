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

/** What a changed password says. */
const DONE_MESSAGE = 'Password changed. You can log in with it now.';

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
  if (!props.asked) {
    return null;
  }
  return choices === null || choices === undefined ? (
    <PasswordField
      autoComplete="url"
      label="Instance"
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
  return (
    <div className={styles['form']}>
      <p className={styles['notice']} role="status">
        {DONE_MESSAGE}
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

/** The new-password box: its fields, the failure of the last send and the send button. */
export function PasswordResetForm(props: PasswordResetFormProps): JSX.Element {
  const { choices } = props;
  const { values, sending, outcome, set, submit } = usePasswordReset(
    props.onSubmit,
    preselectedOrigin(choices),
  );
  if (outcome?.kind === 'ok') {
    return <Done onClose={props.onClose} />;
  }
  return (
    <form
      aria-label="Reset password"
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
        label="New password"
        onChange={(value) => {
          set('password', value);
        }}
        type="password"
        value={values.password}
      />
      <PasswordField
        autoComplete="new-password"
        label="Confirm new password"
        onChange={(value) => {
          set('confirmation', value);
        }}
        type="password"
        value={values.confirmation}
      />
      <Failure outcome={outcome} />
      <button className={styles['button']} disabled={sending} type="submit">
        [ reset password ]
      </button>
    </form>
  );
}
