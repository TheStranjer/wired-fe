/**
 * Every overlay a path or hash route can open over the shell (decision 4):
 * the invite sign-up (WFE-166), the third-party app authorization (WFE-168),
 * the external-login registration and consent (WFE-169) and the new-password
 * box of a reset letter (WFE-163). Root renders the one fragment the hook
 * hands back, and learns from it whether any of them is open, so an error
 * alert (WFE-271) can wait its turn.
 */

import type { JSX } from 'react';

import { useAuthorizeOverlay } from './useAuthorizeOverlay';
import { useExternalOverlay } from './useExternalOverlay';
import { usePasswordResetOverlay } from './usePasswordResetOverlay';
import { useRegistrationOverlay } from './useRegistrationOverlay';

/** The route overlays, and whether any of them is open. */
export type RouteOverlays = {
  readonly elements: JSX.Element;
  readonly open: boolean;
};

/** The route overlays, each present only while its route is open. */
export function useRouteOverlays(ready: boolean): RouteOverlays {
  const registration = useRegistrationOverlay(ready);
  const authorize = useAuthorizeOverlay(ready);
  const external = useExternalOverlay(ready);
  const passwordReset = usePasswordResetOverlay(ready);
  return {
    elements: (
      <>
        {registration}
        {authorize}
        {external}
        {passwordReset}
      </>
    ),
    open: [registration, authorize, external, passwordReset].some((box) => box !== null),
  };
}
