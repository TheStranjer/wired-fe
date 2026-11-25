/**
 * Tests for /split (alias /sp): the definition the command line, /help and
 * completion read, and that it splits the focused pane stacked (`column`), the
 * new pane showing the focused window when no view is named.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './split';
import { fakeCommandContext } from '../../test/commandContext';

describe('/split', () => {
  it('declares its name, alias, grammar and summary', () => {
    expect(command.name).toBe('split');
    expect(command.aliases).toStrictEqual(['sp']);
    expect(command.usage).toMatch(/^\/split \[home\|/u);
    expect(command.summary).toBe('Split the focused pane stacked');
  });

  it('splits the focused pane stacked with the window it shows', async () => {
    const dispatch = vi.fn();
    const context = fakeCommandContext({ dispatch });

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'layout',
      action: { type: 'split', dir: 'column', windowId: 'status' },
    });
  });
});
