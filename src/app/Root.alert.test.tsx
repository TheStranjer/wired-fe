/**
 * The modal alert in the running shell (WFE-271): a failing command raises it
 * over the shell without the Enter that submitted it dismissing it, the next
 * Enter on OK does and hands the keyboard back to the command line, a hotkey
 * pressed while it is open does nothing, and two different errors show one
 * after the other. The line stays in the scrollback throughout.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the shell with nobody signed in and the command line holding focus. */
function renderRoot(): void {
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
  act(() => {
    commandLine().focus();
  });
}

/** The command line, the shell's only textbox. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  fireEvent.change(commandLine(), { target: { value: text } });
  fireEvent.keyDown(commandLine(), { key: 'Enter' });
}

/** The error alert once it is up. */
async function alert(): Promise<HTMLElement> {
  return screen.findByRole('alertdialog', { name: 'Error' });
}

/** Presses Enter on the alert's OK button. */
function pressOk(): void {
  fireEvent.keyDown(screen.getByRole('button', { name: 'OK' }), { key: 'Enter' });
}

describe('the error alert in the shell', () => {
  it('rises for an error line and stays up after the Enter that caused it', async () => {
    renderRoot();

    submit('/nosuch');

    const dialog = await alert();

    expect(dialog).toHaveAccessibleDescription('Unknown command: /nosuch. Try /help');
    expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus();
    expect(
      within(screen.getByRole('log', { name: 'status' })).getByText(
        'Unknown command: /nosuch. Try /help',
      ),
    ).toBeInTheDocument();
  });

  it('is dismissed by the next Enter, and the command line has the keyboard again', async () => {
    renderRoot();
    submit('/nosuch');
    await alert();

    pressOk();

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(commandLine()).toHaveFocus();
    expect(
      within(screen.getByRole('log', { name: 'status' })).getByText(
        'Unknown command: /nosuch. Try /help',
      ),
    ).toBeInTheDocument();
  });

  it('keeps a hotkey from firing while it is open', async () => {
    renderRoot();
    submit('/nosuch');
    await alert();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByText('[INS]')).toBeInTheDocument();
    expect(screen.queryByText('[NAV]')).toBeNull();
  });

  it('shows two different errors one after the other', async () => {
    renderRoot();
    submit('/nosuch');
    await alert();
    submit('/other');

    await within(screen.getByRole('log', { name: 'status' })).findByText(
      'Unknown command: /other. Try /help',
    );
    const first = await alert();

    expect(first).toHaveAccessibleDescription('Unknown command: /nosuch. Try /help');

    pressOk();

    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription(
      'Unknown command: /other. Try /help',
    );

    pressOk();

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(commandLine()).toHaveFocus();
  });

  it('counts a repeat of the same error instead of stacking it', async () => {
    renderRoot();
    submit('/nosuch');
    await alert();
    submit('/nosuch');

    const count = await screen.findByText('(×2)');

    expect(count).toBeInTheDocument();
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  });
});
