/**
 * The third-party app authorization overlay of the shell (WFE-168): wired-be
 * sends a browser that wants to authorize an app to
 * `/oauth/authorize?<request>`, startup turns that into
 * `#/oauth/authorize?<request>` (decision 4), and once startup is done — and
 * on every `hashchange` after — the hook takes the route out of the address
 * bar (so a reload never replays the request) and opens the box for it. The
 * request is kept in memory while the login box, when needed, runs first.
 * Root renders what the hook hands back.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { AuthorizeFlow } from './AuthorizeFlow';
import { useT } from '../i18n/I18nProvider';
import { parseAuthorizeRoute } from '../lib/authorizeRoute';
import { Overlay } from '../ui/Overlay';

/** The query parameters of an authorization request. */
type AuthorizeRequest = Readonly<Record<string, string>>;

/** Takes an authorization route out of the address bar and hands its request to {@link open}, when there is one. */
function openFromHash(open: (request: AuthorizeRequest) => void): void {
  const request = parseAuthorizeRoute(window.location.hash);
  if (request === null) {
    return;
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
  open(request);
}

/** The authorization box over the shell while a request is open, or null while it is not. */
export function useAuthorizeOverlay(ready: boolean): JSX.Element | null {
  const [request, setRequest] = useState<AuthorizeRequest | null>(null);
  const t = useT();

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const run = (): void => {
      openFromHash(setRequest);
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready]);

  if (request === null) {
    return null;
  }
  const close = (): void => {
    setRequest(null);
  };
  return (
    <Overlay label={t('app.authorize_app')} onClose={close}>
      <AuthorizeFlow onClose={close} query={request} />
    </Overlay>
  );
}
