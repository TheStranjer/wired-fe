/**
 * Tests for /vsplit (alias /vs): the definition the command line, /help and
 * completion read, and that it splits the focused pane side by side (`row`), the
 * new pane showing the focused window when no view is named.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './vsplit';
import { fakeCommandContext } from '../../test/commandContext';

describe('/vsplit', () => {
  it('declares its name, alias, grammar and summary', () => {
    expect(command.name).toBe('vsplit');
    expect(command.aliases).toStrictEqual(['vs']);
    expect(command.usage).toMatch(/^\/vsplit \[home\|/u);
    expect(command.summary).toBe('Split the focused pane side by side');
  });

  it('splits the focused pane side by side with the window it shows', async () => {
    const dispatch = vi.fn();
    const context = fakeCommandContext({ dispatch });

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'layout',
      action: { type: 'split', dir: 'row', windowId: 'status' },
    });
  });
});
