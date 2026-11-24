/**
 * The new-password overlay of the shell (WFE-163): wired-be's reset letter
 * links to `/password_reset/<token>` on this origin, startup turns that into
 * `#/password_reset/<token>` (decision 4), and once startup is done — and on
 * every `hashchange` after — the hook takes the route out of the address bar
 * (so the token never lingers in the history or the URL) and opens the box for
 * that token, whether or not anybody is signed in. Root renders what the hook
 * hands back.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { buildConfig } from '../config/config';
import { PasswordResetForm } from '../features/passwordReset/PasswordResetForm';
import {
  type PasswordResetValues,
  submitPasswordReset,
} from '../features/passwordReset/submitPasswordReset';
import { parsePasswordResetRoute } from '../lib/route';
import { Overlay } from '../ui/Overlay';

/** The instance modes that leave the choice of instance to the visitor (decision 3). */
const ASKING_MODES: ReadonlySet<string> = new Set(['list', 'open']);

/** Takes a reset route out of the address bar and hands its token to {@link open}, when there is one. */
function openFromHash(open: (token: string) => void): void {
  const token = parsePasswordResetRoute(window.location.hash);
  if (token === null) {
    return;
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
  open(token);
}

/** The new-password box over the shell while a reset route is open, or null while it is not. */
export function usePasswordResetOverlay(ready: boolean): JSX.Element | null {
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
    <Overlay label="Reset password" onClose={close}>
      <PasswordResetForm
        askInstance={ASKING_MODES.has(buildConfig.instances.mode)}
        onClose={close}
        onSubmit={async (values: PasswordResetValues) =>
          submitPasswordReset(values, {
            token,
            config: buildConfig,
            page: { origin: window.location.origin },
          })
        }
      />
    </Overlay>
  );
}
