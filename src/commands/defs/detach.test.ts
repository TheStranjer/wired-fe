/**
 * Tests for /detach: it empties the pending media list and echoes
 * `attachments cleared`, whatever arguments it was handed.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './detach';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context whose picker slice is stubs, with the clear recorded. */
function detacher(): {
  readonly context: CommandContext;
  readonly clear: ReturnType<typeof vi.fn>;
} {
  const clear = vi.fn();
  return {
    context: fakeCommandContext({ attachments: { pick: vi.fn(), clear, pending: [] } }),
    clear,
  };
}

describe('/detach', () => {
  it('declares its name and grammar', () => {
    expect(command.name).toBe('detach');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/detach');
    expect(command.summary).toBe('Drop every attachment waiting for the next post');
  });

  it('clears the pending list, echoes and returns ok', async () => {
    const { context, clear } = detacher();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(context.print).toHaveBeenCalledWith('attachments cleared');
  });

  it('ignores its arguments and still clears once', async () => {
    const { context, clear } = detacher();

    await command.run('all of them', context);

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
