/**
 * Tests for /start (WFE-299): it asks the app to open the start menu, and its
 * default keys are `Ctrl+B Space` in both modes and `w Space` in navigation
 * mode.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './start';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

describe('/start', () => {
  it('declares its name and grammar', () => {
    expect(command.name).toBe('start');
    expect(command.usage).toBe('/start');
    expect(command.summary).toBe('Open the start menu, to open a view as a float');
  });

  it('opens the start menu', async () => {
    const dispatch = vi.fn<CommandContext['dispatch']>();

    const outcome = await command.run('', fakeCommandContext({ dispatch }));

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'startMenu', open: true });
  });

  it('binds Ctrl+b Space in both modes and w Space in navigation mode', () => {
    expect(command.bindings).toStrictEqual([
      { mode: 'insert', chord: 'Ctrl+b Space', args: '' },
      { mode: 'navigation', chord: 'Ctrl+b Space', args: '' },
      { mode: 'navigation', chord: 'w Space', args: '' },
    ]);
  });
});
