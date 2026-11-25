/**
 * Tests for the runner of card actions (WFE-209): a line that runs goes
 * through the dispatcher like a typed one, and a prefill line fills the command
 * line and enters insert mode, as the prefill hotkeys do.
 */
import { render } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { usePostActionRunner } from './usePostActionRunner';
import type { PostActionRunner } from './usePostActionsApi';
import { buildRegistry } from '../commands/registry';
import type { CommandContext, CommandOutcome, Registry } from '../commands/types';
import { fakeCommandContext } from '../test/commandContext';

const FAV = vi.fn<(args: string) => Promise<CommandOutcome>>().mockResolvedValue({ ok: true });

/** A registry that carries `/fav` and nothing else. */
function favRegistry(): Registry {
  const built = buildRegistry([
    {
      name: 'fav',
      aliases: [],
      usage: '/fav <label>',
      summary: 'Favourite a post',
      run: async (args: string): Promise<CommandOutcome> => await FAV(args),
    },
  ]);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** Mounts the hook and returns the runner it registered. */
function registered(context: CommandContext): PostActionRunner {
  const register = vi.fn<(runner: PostActionRunner) => void>();
  function Host(): JSX.Element {
    const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
    usePostActionRunner(inputRef, context, register);
    return <input aria-label="command line" ref={inputRef} />;
  }
  render(<Host />);
  const runner = register.mock.calls[0]?.[0];
  if (runner === undefined) {
    throw new Error('no runner registered');
  }
  return runner;
}

describe(usePostActionRunner, () => {
  it('runs a line through the dispatcher', async () => {
    const context = fakeCommandContext({ registry: favRegistry() });

    registered(context)({ line: '/fav a3', prefill: false });

    await vi.waitFor(() => {
      expect(FAV).toHaveBeenCalledWith('a3');
    });
  });

  it('fills a prefill line into the command line and enters insert mode', () => {
    const context = fakeCommandContext({ registry: favRegistry() });

    registered(context)({ line: '/reply a3', prefill: true });

    expect(context.setInput).toHaveBeenCalledWith('/reply a3 ');
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'mode', mode: 'insert' });
  });
});
