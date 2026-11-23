/**
 * Sending the sign-up form (decision 3, decision 8): the instance comes from
 * the build's mode (the typed one only matters on a `list` or `open` build),
 * the app cache is the login's own (same origin and redirect URI), and a
 * registration that signs the new account in is adopted into the running
 * session. The password is read from the form's values for the one request and
 * kept nowhere else.
 */

import { type AdoptEnv, adoptAccount } from './adoptAccount';
import { redirectUriFor } from '../../accounts/callback';
import { resolveInstanceOrigin } from '../../accounts/origin';
import { type RegistrationOutcome, registerAccount } from '../../accounts/registerAccount';
import type { WiredConfig } from '../../config/schema';
import type { Store } from '../../storage/store';

/** What the visitor typed into the form. */
export type RegistrationValues = {
  readonly instance: string;
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly agreement: boolean;
  readonly reason: string;
};

/** Everything a send needs besides the form: the invite, the build, the page and the session. */
export type RegistrationEnv = AdoptEnv & {
  /** The invite token of the `/registration/<token>` link. */
  readonly token: string;
  readonly config: WiredConfig;
  /** Where the page is, for the redirect URI the app cache is keyed by. */
  readonly page: { readonly origin: string; readonly pathname: string };
  readonly apps: Store;
  /** The language the new account's mail is in. */
  readonly locale: string;
  readonly now: () => Date;
};

/** Register {@link values} as the invite {@link env} names; a signed-in account joins the session. */
export async function submitRegistration(
  values: RegistrationValues,
  env: RegistrationEnv,
): Promise<RegistrationOutcome> {
  const instance = resolveInstanceOrigin(env.config.instances, env.page.origin, values.instance);
  if (!instance.ok) {
    return { kind: 'error', message: instance.error, fields: {} };
  }
  const outcome = await registerAccount(
    { apps: env.apps, accounts: env.accounts },
    {
      origin: instance.value,
      redirectUri: redirectUriFor(env.page),
      appName: env.config.appName,
      now: env.now().getTime(),
      account: {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        reason: values.reason.trim(),
        locale: env.locale,
        inviteToken: env.token,
      },
    },
  );
  if (outcome.kind === 'ok') {
    await adoptAccount(outcome.account, env);
  }
  return outcome;
}
