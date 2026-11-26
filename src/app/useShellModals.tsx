/**
 * The modal boxes the shell raises itself (WFE-271, WFE-282): the account
 * picker and the error alert. A route overlay that is open keeps the keyboard
 * from both, and the alert also waits for the picker, so at most one box is
 * ever on screen. Root renders the fragment the hook hands back.
 */

import type { JSX } from 'react';

import { useAccountPicker } from './useAccountPicker';
import { useErrorAlert } from './useErrorAlert';
import type { LineRestorer } from './useLineRestoreApi';

/** The picker and the alert, each present only when it may have the keyboard. */
export function useShellModals(routeOverlayOpen: boolean, restore: LineRestorer): JSX.Element {
  const picker = useAccountPicker(routeOverlayOpen, restore);
  const alert = useErrorAlert(routeOverlayOpen || picker !== null);
  return (
    <>
      {picker}
      {alert}
    </>
  );
}
