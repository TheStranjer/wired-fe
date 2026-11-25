/**
 * The shipped vim-style keys on the live hotkeys (decision 18): `Shift+w` runs
 * `/whois` at once, while a bare `w` only waits for its continuation, and
 * Escape drops the wait with nothing run.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it } from 'vitest';

import { appRegistry } from './registry';
import { useHotkeys } from './useHotkeys';
import type { CommandContext } from '../commands/types';
import { usePendingKeys } from '../keys/useGlobalKeys';
import { initialAppState } from '../state/appState';
import { fakeCommandContext } from '../test/commandContext';

/** A navigation-mode context over the shipped registry. */
function navigationContext(): CommandContext {
  const registry = appRegistry();
  if (!registry.ok) {
    throw new Error(`the shipped registry failed to build: ${registry.error}`);
  }
  return fakeCommandContext({
    state: { ...initialAppState(), mode: 'navigation' },
    registry: registry.value,
  });
}

/** Mounts the hook and prints the pending prefix it holds. */
function Host({ context }: { readonly context: CommandContext }): JSX.Element {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const pending = usePendingKeys(context.state.mode);
  useHotkeys(inputRef, context, pending);
  return (
    <>
      <input aria-label="command line" ref={inputRef} />
      <p>{`pending: ${pending.prefix ?? 'none'}`}</p>
    </>
  );
}

describe('the shipped w keys', () => {
  it('wait after a bare w and run nothing when Escape cancels', () => {
    const context = navigationContext();
    render(<Host context={context} />);

    fireEvent.keyDown(window, { key: 'w' });

    expect(screen.getByText('pending: w')).toBeInTheDocument();

    const prevented = !fireEvent.keyDown(window, { key: 'Escape' });

    expect(prevented).toBe(true);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('run /whois on Shift+w without waiting', async () => {
    const context = navigationContext();
    render(<Host context={context} />);

    const prevented = !fireEvent.keyDown(window, { key: 'W', shiftKey: true });

    expect(prevented).toBe(true);
    expect(screen.getByText('pending: none')).toBeInTheDocument();

    await waitFor(() => {
      expect(context.print).toHaveBeenCalledWith('Not logged in. Type /connect', 'error');
    });
  });
});
