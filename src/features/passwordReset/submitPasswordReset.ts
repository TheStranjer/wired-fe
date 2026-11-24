/**
 * Sending the new-password form (decision 3): the passwords are compared in
 * the browser first, so a typo never reaches the instance; the instance comes
 * from the build's mode (the typed one only matters on a `list` or `open`
 * build); the instance's own error string is what a refusal says. The
 * passwords are read from the form's values for the one request and kept
 * nowhere else.
 */

import { resolveInstanceOrigin } from '../../accounts/origin';
import { completePasswordReset } from '../../api/endpoints/passwordReset';
import { describeApiError } from '../../api/errors';
import type { WiredConfig } from '../../config/schema';

/** What the visitor typed into the form. */
export type PasswordResetValues = {
  readonly instance: string;
  readonly password: string;
  readonly confirmation: string;
};

/** What a send came to: the password is changed, or one message saying why not. */
export type PasswordResetOutcome =
  { readonly kind: 'ok' } | { readonly kind: 'error'; readonly message: string };

/** Everything a send needs besides the form: the reset token, the build and the page. */
export type PasswordResetEnv = {
  /** The token of the `#/password_reset/<token>` link. */
  readonly token: string;
  readonly config: WiredConfig;
  readonly page: { readonly origin: string };
};

/** Shown when the two fields differ. */
const MISMATCH_MESSAGE = 'The two passwords do not match.';

/** Shown when the new password is empty. */
const EMPTY_MESSAGE = 'Enter a new password.';

/** The error {@link message} as an outcome. */
function failed(message: string): PasswordResetOutcome {
  return { kind: 'error', message };
}

/** Change the password {@link values} spell for the reset {@link env} names. */
export async function submitPasswordReset(
  values: PasswordResetValues,
  env: PasswordResetEnv,
): Promise<PasswordResetOutcome> {
  if (values.password === '') {
    return failed(EMPTY_MESSAGE);
  }
  if (values.password !== values.confirmation) {
    return failed(MISMATCH_MESSAGE);
  }
  const instance = resolveInstanceOrigin(env.config.instances, env.page.origin, values.instance);
  if (!instance.ok) {
    return failed(instance.error);
  }
  const done = await completePasswordReset(instance.value, {
    token: env.token,
    password: values.password,
    passwordConfirmation: values.confirmation,
  });
  if (done.ok) {
    return { kind: 'ok' };
  }
  return failed(done.error.kind === 'http' ? done.error.message : describeApiError(done.error));
}
