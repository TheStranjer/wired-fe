/**
 * Tests for `/set theme <name>` (WFE-131, the part of /set too big for its
 * sibling file): the theme knob prints its listed line with the reader's own
 * value, takes one of the three names — dispatching the settings patch and
 * printing `theme = <name>` back — and refuses any other word with the names
 * that would have passed, touching nothing. `/theme` is the same knob's own
 * command; its listing lives in theme.test.ts.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './set';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** The theme knob's listed line as a default session and a lain session read it. */
const LINE = '  theme = wired  — The colors the shell is painted in';

const LAIN_LINE = '  theme = lain  — The colors the shell is painted in';

/** A context over a session whose settings are {@link settings}, print recorded. */
function contextWith(settings: Settings = DEFAULT_SETTINGS): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const state: AppState = initialAppState(settings);
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, print }), print };
}

describe('/set theme', () => {
  it('prints the theme knob’s one line, the reader’s own value and all', async () => {
    const { context, print } = contextWith({ ...DEFAULT_SETTINGS, theme: 'lain' });

    const outcome = await command.run('theme', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith(LAIN_LINE);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('shows the default as wired', async () => {
    const { context, print } = contextWith();

    await command.run('theme', context);

    expect(print).toHaveBeenCalledWith(LINE);
  });

  it('sets a named theme, dispatches the patch and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('theme bnet', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { theme: 'bnet' },
    });
    expect(print).toHaveBeenCalledWith('theme = bnet');
  });

  it('refuses a word the theme knob does not list, naming the themes', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('theme pastel', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'theme takes wired|lain|bnet' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });
});
