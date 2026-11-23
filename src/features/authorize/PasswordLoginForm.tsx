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
import type { PasswordOutcome } from '../../accounts/passwordLogin';

/** What the form shows and the callbacks it drives. */
export type PasswordLoginFormProps = {
  /** Whether the build leaves the instance to the visitor (a `list` or `open` build). */
  readonly askInstance: boolean;
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
  return (
    <div className={styles['actions']}>
      <button className={styles['button']} disabled={props.sending} type="submit">
        [ log in ]
      </button>
      <button
        className={styles['button']}
        onClick={() => {
          props.onClose();
        }}
        type="button"
      >
        [ cancel ]
      </button>
    </div>
  );
}

/** The login box: its fields, the failure of the last send, and the send and cancel buttons. */
export function PasswordLoginForm(props: PasswordLoginFormProps): JSX.Element {
  const { values, sending, failure, set, submit } = useLoginForm(props.onSubmit);
  return (
    <form
      aria-label="Log in"
      className={styles['form']}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <p className={styles['line']}>Log in to authorize the app.</p>
      {props.askInstance ? (
        <Input
          autoComplete="url"
          label="Instance"
          onChange={set('instance')}
          type="text"
          value={values.instance}
        />
      ) : null}
      <Input
        autoComplete="username"
        label="Username"
        onChange={set('username')}
        type="text"
        value={values.username}
      />
      <Input
        autoComplete="current-password"
        label="Password"
        onChange={set('password')}
        type="password"
        value={values.password}
      />
      <Failure message={failure} />
      <Actions onClose={props.onClose} sending={sending} />
    </form>
  );
}
