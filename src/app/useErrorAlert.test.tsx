/**
 * The hook behind the shell's error alert (WFE-271): nothing while the queue
 * is empty, the head of the queue while it is not, nothing while another modal
 * holds the keyboard — the alert waits, queued — and the next alert after OK.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useErrorAlert } from './useErrorAlert';
import { type AppState, initialAppState, printAction } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';

/** Mounts the hook and renders what it hands back. */
function Host(props: { readonly blocked: boolean }): JSX.Element {
  const alert = useErrorAlert(props.blocked);
  return <>{alert}</>;
}

/** A session with each of {@link texts} raised as an error line. */
function sessionWith(...texts: readonly string[]): AppState {
  return texts.reduce(
    (state, text) => appReducer(state, printAction(null, 'error', text)),
    initialAppState(),
  );
}

describe(useErrorAlert, () => {
  it('shows nothing while no error was raised', () => {
    render(
      <AppStateProvider>
        <Host blocked={false} />
      </AppStateProvider>,
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the head of the queue and the next one after OK', () => {
    render(
      <AppStateProvider initial={sessionWith('first', 'second')}>
        <Host blocked={false} />
      </AppStateProvider>,
    );

    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription('first');

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription(
      'second',
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('waits while another modal is open and shows once it closes', () => {
    const view = render(
      <AppStateProvider initial={sessionWith('held back')}>
        <Host blocked />
      </AppStateProvider>,
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();

    view.rerender(
      <AppStateProvider initial={sessionWith('held back')}>
        <Host blocked={false} />
      </AppStateProvider>,
    );

    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription(
      'held back',
    );
  });
});
