/**
 * The password login an authorization request asks for when nobody is signed
 * in to its instance (WFE-168, decision 8): the instance comes from the build's
 * mode (the typed one only matters on a `list` or `open` build), the app cache
 * is the login's own (same origin and redirect URI), and the account that
 * comes of it joins the running session. The password is read from the form's
 * values for the one request and kept nowhere else. Also finds the account
 * that is already signed in, if any.
 */

import type { AccountStore, StoredAccount } from '../accounts/accountStore';
import { redirectUriFor } from '../accounts/callback';
import { resolveInstanceOrigin } from '../accounts/origin';
import { type PasswordOutcome, passwordLogin } from '../accounts/passwordLogin';
import { buildConfig } from '../config/config';
import type { InstancesConfig } from '../config/schema';
import type { LoginValues } from '../features/authorize/useLoginForm';
import { type AdoptEnv, adoptAccount } from '../features/registration/adoptAccount';
import { ok } from '../lib/result';
import type { Store } from '../storage/store';

/** What a login needs besides the form: the build, the page, the stores and the session. */
export type LoginEnv = AdoptEnv & {
  readonly apps: Store;
  /** Which instances the build may talk to (decision 3). */
  readonly instances: InstancesConfig;
  /** The instance the request is for, or null when the visitor must name it. */
  readonly origin: string | null;
  readonly now: () => Date;
};

/**
 * The instance an authorization request is for, when it is known without
 * asking: the one the build fixes (`same-origin`, `fixed`), else the active
 * account's, else null.
 */
export function requestOrigin(accounts: AccountStore, instances: InstancesConfig): string | null {
  const fixed = resolveInstanceOrigin(instances, window.location.origin, '');
  if (fixed.ok) {
    return fixed.value;
  }
  const key = accounts.activeKey();
  return (key === null ? undefined : accounts.get(key))?.origin ?? null;
}

/** The signed-in account for {@link origin}: the active one when it lives there, else the first that does. */
export function accountAt(accounts: AccountStore, origin: string | null): StoredAccount | null {
  const here = accounts.list().filter((account) => account.origin === origin);
  return here.find((account) => account.key === accounts.activeKey()) ?? here[0] ?? null;
}

/** Log {@link values} in; an account that comes of it joins the session. */
export async function loginForAuthorize(
  values: LoginValues,
  env: LoginEnv,
): Promise<PasswordOutcome> {
  const page = { origin: window.location.origin, pathname: window.location.pathname };
  const instance =
    env.origin === null
      ? resolveInstanceOrigin(env.instances, page.origin, values.instance)
      : ok(env.origin);
  if (!instance.ok) {
    return { kind: 'error', message: instance.error };
  }
  const outcome = await passwordLogin(
    { apps: env.apps, accounts: env.accounts },
    {
      origin: instance.value,
      redirectUri: redirectUriFor(page),
      appName: buildConfig.appName,
      username: values.username.trim(),
      password: values.password,
      now: env.now().getTime(),
    },
  );
  if (outcome.kind === 'ok') {
    await adoptAccount(outcome.account, env);
  }
  return outcome;
}
