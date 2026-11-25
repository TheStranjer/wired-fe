/**
 * The modal alert of the shell (WFE-271): every error line the app prints
 * queues an alert in the state (src/state/alerts), and while one is queued
 * the box shows the head of the queue. OK, Enter, Space and Escape dismiss
 * it, and the next one, if any, shows straight after; when the queue empties
 * the {@link Overlay} gives focus back to whatever held it, normally the
 * command line. A route overlay that is already open (login, registration)
 * keeps the keyboard: the alert waits, queued, until that box closes. Root
 * renders what the hook hands back.
 */

import type { JSX } from 'react';

import { useAppDispatch, useAppState } from '../state/StateContext';
import { ErrorAlert } from '../ui/ErrorAlert';

/** The alert box for the head of the queue, or null while the queue is empty or another modal holds the keyboard. */
export function useErrorAlert(otherModalOpen: boolean): JSX.Element | null {
  const { alerts } = useAppState();
  const dispatch = useAppDispatch();
  const head = alerts.at(0);
  if (head === undefined || otherModalOpen) {
    return null;
  }
  return (
    <ErrorAlert
      count={head.count}
      key={head.id}
      onDismiss={() => {
        dispatch({ type: 'dismissAlert' });
      }}
      text={head.text}
    />
  );
}
