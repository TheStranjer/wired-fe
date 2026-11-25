/**
 * Tests for the command history the arrow keys walk in the shell's command
 * line (WFE-122): submitted lines recalled newest-first and staying at the
 * oldest, the typed draft kept under the browsing and returned to past the
 * newest, resubmitting a recalled line not doubling it, and arrow chords and
 * navigation mode left to the keymap. Startup is mocked; it has its own tests.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { AppStateProvider } from '../state/StateContext';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render Root over a fresh session. */
function renderRoot(): void {
  render(
    <AppStateProvider initial={initialAppState()}>
      <Root />
    </AppStateProvider>,
  );
}

/** The command line, the shell's only textbox. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  const input = commandLine();

  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

/** Submits {@link lines}, waiting for the line to clear after each. */
async function submitAll(input: HTMLElement, ...lines: readonly string[]): Promise<void> {
  for (const line of lines) {
    submit(line);
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  }
}

describe(Root, () => {
  it('ArrowUp recalls the submitted lines, newest first, and stays at the oldest', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'first line', 'second line');

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('second line');

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('first line');

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('first line');
  });

  it('ArrowDown walks back to the newest entry and returns to the draft', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'first line', 'second line');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input).toHaveValue('second line');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input).toHaveValue('');
  });

  it('the first ArrowUp keeps what the line holds as the draft', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'a submitted line');

    fireEvent.change(input, { target: { value: 'half typed' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('a submitted line');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input).toHaveValue('half typed');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input).toHaveValue('half typed');
  });

  it('a recalled line submitted again does not double the history', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'only line');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('only line');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input).toHaveValue('');
  });

  it('arrow chords with modifiers are left to their bindings', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'a submitted line');

    fireEvent.keyDown(input, { key: 'ArrowUp', ctrlKey: true });

    expect(input).toHaveValue('');
  });

  it('the arrows do not recall while navigation is shown', async () => {
    renderRoot();
    const input = commandLine();

    await submitAll(input, 'a submitted line');
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveValue('');
  });
});
