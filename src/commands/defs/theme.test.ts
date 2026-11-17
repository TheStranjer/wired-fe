/**
 * Tests for /theme: no argument prints a `Themes:` header and one `  <name>`
 * line per theme with `(current)` beside the one the settings choose; a name
 * dispatches the settings patch and prints `theme = <name>` back — the
 * reader's own current theme is what gets tagged, and a name that is not a
 * theme (or only one with different case) is refused without touching state,
 * while a second word echoes the usage.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './theme';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context over a session whose settings are {@link settings}, print recorded. */
function contextWith(settings: Settings = DEFAULT_SETTINGS): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const state: AppState = initialAppState(settings);
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, print }), print };
}

describe('/theme', () => {
  it('is /theme with no aliases', () => {
    expect(command.name).toBe('theme');
    expect(command.aliases).toStrictEqual([]);
  });

  it('lists every theme and marks the default current when given nothing', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      ['Themes:'],
      ['  wired (current)'],
      ['  lain'],
      ['  bnet'],
    ]);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('marks the reader’s own theme, not the default', async () => {
    const { context, print } = contextWith({ ...DEFAULT_SETTINGS, theme: 'bnet' });

    await command.run('', context);

    expect(print.mock.calls).toStrictEqual([
      ['Themes:'],
      ['  wired'],
      ['  lain'],
      ['  bnet (current)'],
    ]);
  });

  it('sets a named theme, dispatching the patch and printing it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('lain', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { theme: 'lain' },
    });
    expect(print).toHaveBeenCalledWith('theme = lain');
  });

  it('collapses the whitespace around the name', async () => {
    const { context } = contextWith();

    const outcome = await command.run('   bnet  ', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { theme: 'bnet' },
    });
  });

  it('refuses a name that is no theme, without touching state', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('pastel', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No theme pastel. Try /theme' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it('takes names case-sensitively', async () => {
    const { context } = contextWith();

    const outcome = await command.run('Lain', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No theme Lain. Try /theme' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('echoes the usage when a second word arrives', async () => {
    const { context } = contextWith();

    const outcome = await command.run('lain please', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /theme [name]' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
