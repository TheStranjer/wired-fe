/**
 * The external-login overlay of the shell (WFE-169): after a sign-in with
 * another provider wired-be sends the browser to
 * `/oauth/external/register?state=` (a new account to finish) or
 * `/oauth/external/consent?state=&confirm_token=` (an app to approve); startup
 * turns that into the hash route (decision 4), and once startup is done — and
 * on every `hashchange` after — the hook takes the route out of the address bar
 * (so a reload never replays the state) and opens the matching box. Neither
 * flow needs a signed-in account. The instance is the build's own (decision 3),
 * else the active account's, else the page's. Root renders what the hook hands
 * back.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { externalOrigin } from './externalOrigin';
import { navigateTo } from './navigate';
import { appStores } from './stores';
import { buildConfig } from '../config/config';
import { ConsentBox } from '../features/external/ConsentBox';
import { RegisterBox } from '../features/external/RegisterBox';
import { useT } from '../i18n/I18nProvider';
import { type ExternalRoute, parseExternalRoute } from '../lib/externalRoute';
import { Overlay } from '../ui/Overlay';

/** Takes an external-login route out of the address bar and hands it to {@link open}, when there is one. */
function openFromHash(open: (route: ExternalRoute) => void): void {
  const route = parseExternalRoute(window.location.hash);
  if (route === null) {
    return;
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
  open(route);
}

/** The box for {@link route}, talking to the instance it belongs to. */
function ExternalBox(props: {
  readonly route: ExternalRoute;
  readonly onClose: () => void;
}): JSX.Element {
  const { route, onClose } = props;
  const origin = externalOrigin(
    appStores().accounts,
    buildConfig.instances,
    window.location.origin,
  );
  if (route.kind === 'register') {
    return (
      <RegisterBox navigate={navigateTo} onClose={onClose} origin={origin} state={route.state} />
    );
  }
  return (
    <ConsentBox
      confirmToken={route.confirmToken}
      navigate={navigateTo}
      onClose={onClose}
      origin={origin}
      state={route.state}
    />
  );
}

/** The box over the shell while an external-login route is open, or null while it is not. */
export function useExternalOverlay(ready: boolean): JSX.Element | null {
  const [route, setRoute] = useState<ExternalRoute | null>(null);
  const t = useT();

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const run = (): void => {
      openFromHash(setRoute);
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready]);

  if (route === null) {
    return null;
  }
  const close = (): void => {
    setRoute(null);
  };
  return (
    <Overlay
      label={t(route.kind === 'register' ? 'app.finish_registration' : 'app.authorize_app')}
      onClose={close}
    >
      <ExternalBox onClose={close} route={route} />
    </Overlay>
  );
}
