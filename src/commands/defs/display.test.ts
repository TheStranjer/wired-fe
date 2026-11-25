/**
 * Tests for `/display` (decision 15): the bare form prints the active
 * window's effective values and which are overridden, a key alone prints its
 * line, a key and a value dispatch the override, `reset` clears one key or
 * all, and a bad key, a bad value or a stray word is refused untouched.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './display';
import { initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import { type DisplayOverrides, STATUS_WINDOW_ID, initialWindowsState } from '../../windows/model';
import type { CommandContext } from '../types';

/** A context whose active window carries {@link display}, print recorded. */
function contextWith(display: DisplayOverrides = {}): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const [status] = initialWindowsState().windows;
  if (status === undefined) {
    throw new Error('no status window');
  }
  const windows = { windows: [{ ...status, display }], activeId: STATUS_WINDOW_ID };
  const state = initialAppState({ ...DEFAULT_SETTINGS, avatars: false });
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, windows, print }), print };
}

/** What was asked of the window layer, as `setDisplay` for the status window. */
function setDisplay(overrides: object): object {
  return { type: 'setDisplay', id: STATUS_WINDOW_ID, overrides };
}

describe('/display with no argument', () => {
  it('prints every effective value, tagged inherited when nothing is overridden', async () => {
    const { context, print } = contextWith();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(print.mock.calls).toStrictEqual([
      ['  density = cards  (inherited)'],
      ['  avatars = off  (inherited)'],
      ['  images = on  (inherited)'],
    ]);
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('tags the overridden ones and prints the window’s own values', async () => {
    const { context, print } = contextWith({ density: 'lines', avatars: true });

    await command.run('', context);

    expect(print.mock.calls).toStrictEqual([
      ['  density = lines  (overridden)'],
      ['  avatars = on  (overridden)'],
      ['  images = on  (inherited)'],
    ]);
  });
});

describe('/display <key>', () => {
  it('prints just that key’s line', async () => {
    const { context, print } = contextWith({ images: false });

    await expect(command.run('images', context)).resolves.toStrictEqual({ ok: true });

    expect(print.mock.calls).toStrictEqual([['  images = off  (overridden)']]);
  });
});

describe('/display <key> <value>', () => {
  it.each(['cards', 'lines'])('overrides density to %s', async (word) => {
    const { context, print } = contextWith();

    await expect(command.run(`density ${word}`, context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(setDisplay({ density: word }));
    expect(print).toHaveBeenCalledWith(`density = ${word}`);
  });

  it.each([
    ['off', false, 'off'],
    ['no', false, 'off'],
    ['false', false, 'off'],
    ['on', true, 'on'],
    ['yes', true, 'on'],
    ['true', true, 'on'],
  ])('overrides avatars with %s', async (word, value, printed) => {
    const { context, print } = contextWith();

    await command.run(`avatars ${word}`, context);

    expect(context.dispatchWindows).toHaveBeenCalledWith(setDisplay({ avatars: value }));
    expect(print).toHaveBeenCalledWith(`avatars = ${printed}`);
  });

  it('overrides images', async () => {
    const { context, print } = contextWith();

    await command.run('images off', context);

    expect(context.dispatchWindows).toHaveBeenCalledWith(setDisplay({ images: false }));
    expect(print).toHaveBeenCalledWith('images = off');
  });

  it('refuses a density the setting does not list', async () => {
    const { context, print } = contextWith();

    await expect(command.run('density compact', context)).resolves.toStrictEqual({
      ok: false,
      message: 'density takes cards|lines',
    });
    expect(context.dispatchWindows).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it.each(['avatars', 'images'])('refuses a word %s does not take', async (key) => {
    const { context } = contextWith();

    await expect(command.run(`${key} maybe`, context)).resolves.toStrictEqual({
      ok: false,
      message: `${key} takes on|off|true|false|yes|no`,
    });
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses an unknown key', async () => {
    const { context } = contextWith();

    await expect(command.run('theme lain', context)).resolves.toStrictEqual({
      ok: false,
      message: 'No display key theme. Try /display',
    });
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('echoes the usage for a third word', async () => {
    const { context } = contextWith();

    await expect(command.run('density lines now', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /display [key [value] | reset [key]]',
    });
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });
});

describe('/display reset', () => {
  it('clears every override of the window', async () => {
    const { context, print } = contextWith({ density: 'lines' });

    await expect(command.run('reset', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(
      setDisplay({ density: undefined, avatars: undefined, images: undefined }),
    );
    expect(print).toHaveBeenCalledWith('Display overrides cleared');
  });

  it.each(['density', 'avatars', 'images'])('clears just %s', async (key) => {
    const { context, print } = contextWith();

    await expect(command.run(`reset ${key}`, context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(setDisplay({ [key]: undefined }));
    expect(print).toHaveBeenCalledWith(`${key} inherited`);
  });

  it('refuses a key it does not know', async () => {
    const { context } = contextWith();

    await expect(command.run('reset theme', context)).resolves.toStrictEqual({
      ok: false,
      message: 'No display key theme. Try /display',
    });
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });
});
