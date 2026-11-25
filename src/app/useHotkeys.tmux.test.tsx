/**
 * The shipped tmux-style keys through the global key handler (decision 18):
 * `Ctrl+B` is swallowed so the browser never sees it and waits as the pending
 * prefix, and the next key runs the command it names.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it } from 'vitest';

import { useHotkeys } from './useHotkeys';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';
import type { CommandContext } from '../commands/types';
import { usePendingKeys } from '../keys/useGlobalKeys';
import { initialAppState } from '../state/appState';
import { fakeCommandContext } from '../test/commandContext';

/** The context of a session in {@link mode} over the shipped commands. */
function shippedContext(mode: 'insert' | 'navigation'): CommandContext {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(definitions.error);
  }
  const built = buildRegistry(definitions.value);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return fakeCommandContext({ state: { ...initialAppState(), mode }, registry: built.value });
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

describe('the tmux-style keys on the hotkeys', () => {
  it.each(['insert', 'navigation'] as const)(
    'Ctrl+B c opens a new desktop in %s mode',
    async (mode) => {
      const context = shippedContext(mode);
      render(<Host context={context} />);

      const first = fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

      expect(first).toBe(false);
      expect(screen.getByText('pending: Ctrl+b')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'c' });
      await waitFor(() => {
        expect(context.dispatch).toHaveBeenCalledWith({
          type: 'layout',
          action: { type: 'newDesktop' },
        });
      });

      expect(screen.getByText('pending: none')).toBeInTheDocument();
    },
  );

  it('reads % as the character with Shift implied and swallows it', () => {
    const context = shippedContext('insert');
    render(<Host context={context} />);

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    const second = fireEvent.keyDown(window, { key: '%', shiftKey: true });

    expect(second).toBe(false);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
  });
});
