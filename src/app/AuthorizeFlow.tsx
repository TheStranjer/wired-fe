/**
 * One third-party app authorization request, start to finish (WFE-168): with
 * no account signed in to the request's instance the password login comes
 * first, and the request waits in this component's props until it succeeds;
 * then the authorization box takes over as that account.
 */

import { useMemo, useState } from 'react';
import type { JSX } from 'react';

import { accountAt, loginForAuthorize, requestOrigin } from './authorizeLogin';
import { navigateTo } from './navigate';
import { appStores } from './stores';
import type { StoredAccount } from '../accounts/accountStore';
import { detectInstance } from '../capabilities/detect';
import { refreshingDetect } from '../capabilities/profileCache';
import { buildConfig } from '../config/config';
import { AuthorizeBox } from '../features/authorize/AuthorizeBox';
import { PasswordLoginForm } from '../features/authorize/PasswordLoginForm';
import type { LoginValues } from '../features/authorize/useLoginForm';
import { useAppDispatch } from '../state/StateContext';

/** The request being authorized and what closing it means. */
type FlowProps = {
  /** The query parameters of the app's authorization request. */
  readonly query: Readonly<Record<string, string>>;
  readonly onClose: () => void;
};

/** The authorization box, as the signed-in {@link account}. */
function SignedIn(props: FlowProps & { readonly account: StoredAccount }): JSX.Element {
  const { account } = props;
  const session = useMemo(
    () => ({ origin: account.origin, token: account.token }),
    [account.origin, account.token],
  );
  return (
    <AuthorizeBox
      handle={account.handle}
      navigate={navigateTo}
      onClose={props.onClose}
      query={props.query}
      session={session}
    />
  );
}

/** The login, then the authorization of {@link props}.query. */
export function AuthorizeFlow(props: FlowProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [origin] = useState(() => requestOrigin(appStores().accounts, buildConfig.instances));
  const [account, setAccount] = useState(() => accountAt(appStores().accounts, origin));

  if (account !== null) {
    return <SignedIn {...props} account={account} />;
  }
  const login = async (values: LoginValues): ReturnType<typeof loginForAuthorize> => {
    const { accounts, apps, profiles } = appStores();
    const outcome = await loginForAuthorize(values, {
      dispatch,
      accounts,
      apps,
      instances: buildConfig.instances,
      origin,
      detect: refreshingDetect(profiles, detectInstance, () => Date.now()),
      now: () => new Date(),
    });
    if (outcome.kind === 'ok') {
      setAccount(outcome.account);
    }
    return outcome;
  };
  return (
    <PasswordLoginForm askInstance={origin === null} onClose={props.onClose} onSubmit={login} />
  );
}
