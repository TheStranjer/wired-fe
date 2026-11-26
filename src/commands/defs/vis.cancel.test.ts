/**
 * Tests for /vis <word> <text> when the reader cancels the alt-text review
 * (WFE-294): their own choice, so the command succeeds without printing
 * anything and leaves the default audience alone.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './vis';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

describe('/vis <word> <text> after a cancelled review', () => {
  it('succeeds without a word and leaves the default alone', async () => {
    const context = fakeCommandContext({
      post: vi.fn<CommandContext['post']>().mockResolvedValue({ cancelled: true }),
    });

    await expect(command.run('public sup', context)).resolves.toStrictEqual({ ok: true });

    expect(context.post).toHaveBeenCalledExactlyOnceWith({ text: 'sup', visibility: 'public' });
    expect(context.print).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
