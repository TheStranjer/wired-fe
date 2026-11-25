/**
 * Tests for multi-chord bindings on the wired hotkeys (decision 18): the first
 * chord of a sequence is swallowed and shown as the pending prefix, the next
 * chord completes the binding and runs its line, an unbound continuation or
 * Escape cancels the wait and is swallowed too, and a lone chord with no
 * sequence behind it still falls through to the keyboard.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useHotkeys } from './useHotkeys';
import { buildRegistry } from '../commands/registry';
import type { CommandContext, CommandOutcome } from '../commands/types';
import { usePendingKeys } from '../keys/useGlobalKeys';
import { initialAppState } from '../state/appState';
import { fakeCommandContext } from '../test/commandContext';

/** The one outcome the stub commands report. */
const OK: CommandOutcome = { ok: true };

/** Records every run of /split. */
const SPLIT_RUN = vi.fn(async (): Promise<CommandOutcome> => await Promise.resolve(OK));

/** Records every run of /pane. */
const PANE_RUN = vi.fn(async (): Promise<CommandOutcome> => await Promise.resolve(OK));

/** /split on navigation `w v`; /pane on `Ctrl+b %` in insert mode. */
const DEFINITIONS = [
  {
    name: 'split',
    aliases: [],
    usage: '/split',
    summary: 'Split the pane',
    run: SPLIT_RUN,
    bindings: [{ mode: 'navigation', chord: 'w v', args: '' }],
  },
  {
    name: 'pane',
    aliases: [],
    usage: '/pane',
    summary: 'Do a pane thing',
    run: PANE_RUN,
    bindings: [{ mode: 'insert', chord: 'Ctrl+b %', args: 'tmux' }],
  },
] as const;

/** The context of a session in {@link mode} over {@link DEFINITIONS}. */
function sequenceContext(mode: 'insert' | 'navigation'): CommandContext {
  const built = buildRegistry(DEFINITIONS);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return fakeCommandContext({ state: { ...initialAppState(), mode }, registry: built.value });
}

/** Mounts the hook and prints the pending prefix it holds, so a test can read it. */
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

describe('key sequences on the hotkeys', () => {
  it('swallows the first chord, shows the prefix, and runs the line on the second', async () => {
    const context = sequenceContext('navigation');
    render(<Host context={context} />);

    const first = fireEvent.keyDown(window, { key: 'w' });

    expect(first).toBe(false);
    expect(screen.getByText('pending: w')).toBeInTheDocument();

    const second = fireEvent.keyDown(window, { key: 'v' });
    await waitFor(() => {
      expect(SPLIT_RUN).toHaveBeenCalledWith('', context);
    });

    expect(second).toBe(false);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
  });

  it('carries a modified prefix chord into the insert-mode sequence', async () => {
    const context = sequenceContext('insert');
    render(<Host context={context} />);

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

    expect(screen.getByText('pending: Ctrl+b')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '%', shiftKey: true });

    await waitFor(() => {
      expect(PANE_RUN).toHaveBeenCalledWith('tmux', context);
    });
  });

  it('cancels on a chord that continues nothing, swallowing it', () => {
    const context = sequenceContext('navigation');
    render(<Host context={context} />);
    fireEvent.keyDown(window, { key: 'w' });

    const prevented = !fireEvent.keyDown(window, { key: 'x' });

    expect(prevented).toBe(true);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
    expect(SPLIT_RUN).not.toHaveBeenCalled();
  });

  it('cancels on Escape without leaving the mode', () => {
    const context = sequenceContext('navigation');
    render(<Host context={context} />);
    fireEvent.keyDown(window, { key: 'w' });

    const prevented = !fireEvent.keyDown(window, { key: 'Escape' });

    expect(prevented).toBe(true);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('lets a lone chord that starts no sequence through to the keyboard', () => {
    const context = sequenceContext('navigation');
    render(<Host context={context} />);

    const notPrevented = fireEvent.keyDown(window, { key: 'z' });

    expect(notPrevented).toBe(true);
    expect(screen.getByText('pending: none')).toBeInTheDocument();
  });
});
