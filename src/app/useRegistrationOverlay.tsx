/**
 * The sign-up overlay of the shell (WFE-166): wired-be's invite links arrive
 * as `/registration/<token>`, startup turns that into `#/registration/<token>`
 * (decision 4), and once startup is done — and on every `hashchange` after —
 * the hook takes the route out of the address bar and opens the box for that
 * token, whether or not anybody is signed in. The box registers through the
 * login's app cache and, when the new account comes signed in, hands it to the
 * running session. Root renders what the hook hands back.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { appStores } from './stores';
import { instanceChoices } from '../accounts/origin';
import { detectInstance } from '../capabilities/detect';
import { refreshingDetect } from '../capabilities/profileCache';
import { buildConfig } from '../config/config';
import { RegistrationForm } from '../features/registration/RegistrationForm';
import {
  type RegistrationEnv,
  type RegistrationValues,
  submitRegistration,
} from '../features/registration/submitRegistration';
import { localeOf } from '../lib/locale';
import { parseRegistrationRoute } from '../lib/route';
import { useAppDispatch } from '../state/StateContext';
import { Overlay } from '../ui/Overlay';

/** The instance modes that leave the choice of instance to the visitor (decision 3). */
const ASKING_MODES: ReadonlySet<string> = new Set(['list', 'open']);

/** The pieces of one send that do not come from the form, for the invite {@link token}. */
function envFor(token: string, dispatch: RegistrationEnv['dispatch']): RegistrationEnv {
  const { accounts, apps, profiles } = appStores();
  return {
    token,
    dispatch,
    accounts,
    apps,
    detect: refreshingDetect(profiles, detectInstance, () => Date.now()),
    config: buildConfig,
    page: { origin: window.location.origin, pathname: window.location.pathname },
    locale: localeOf(navigator.language),
    now: () => new Date(),
  };
}

/** Takes an invite route out of the address bar and hands its token to {@link open}, when there is one. */
function openFromHash(open: (token: string) => void): void {
  const token = parseRegistrationRoute(window.location.hash);
  if (token === null) {
    return;
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
  open(token);
}

/** The sign-up box over the shell while an invite route is open, or null while it is not. */
export function useRegistrationOverlay(ready: boolean): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const run = (): void => {
      openFromHash(setToken);
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready]);

  if (token === null) {
    return null;
  }
  const close = (): void => {
    setToken(null);
  };
  return (
    <Overlay label="Sign up" onClose={close}>
      <RegistrationForm
        askInstance={ASKING_MODES.has(buildConfig.instances.mode)}
        choices={instanceChoices(buildConfig.instances)}
        onClose={close}
        onSubmit={async (values: RegistrationValues) =>
          submitRegistration(values, envFor(token, dispatch))
        }
      />
    </Overlay>
  );
}
