/**
 * Tests for `/set density|avatars|images` (WFE-192, decision 15): each knob
 * prints its listed line with the reader's own value, takes its words —
 * dispatching the settings patch and printing `<key> = <word>` back — and
 * refuses any other word with the ones that would have passed, touching
 * nothing.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './set';
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

describe('/set density', () => {
  it('prints the knob’s one line, the reader’s own value and all', async () => {
    const { context, print } = contextWith({ ...DEFAULT_SETTINGS, density: 'lines' });

    const outcome = await command.run('density', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print).toHaveBeenCalledWith(
      '  density = lines  — How posts render: as cards or as IRC lines',
    );
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it.each(['cards', 'lines'])('sets %s, dispatches the patch and prints it back', async (word) => {
    const { context, print } = contextWith();

    const outcome = await command.run(`density ${word}`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { density: word },
    });
    expect(print).toHaveBeenCalledWith(`density = ${word}`);
  });

  it('refuses a word the knob does not list, naming the ones it does', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('density compact', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'density takes cards|lines' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });
});

describe.each(['avatars', 'images'])('/set %s', (key) => {
  it('prints the knob’s one line as on by default and off once turned', async () => {
    const off = contextWith({ ...DEFAULT_SETTINGS, avatars: false, images: false });
    const on = contextWith();

    await command.run(key, off.context);
    await command.run(key, on.context);

    expect(off.print.mock.calls[0]?.[0]).toMatch(new RegExp(`^ {2}${key} = off {2}— `, 'u'));
    expect(on.print.mock.calls[0]?.[0]).toMatch(new RegExp(`^ {2}${key} = on {2}— `, 'u'));
  });

  it.each([
    ['off', false],
    ['no', false],
    ['on', true],
    ['yes', true],
  ])('reads %s as %s, dispatches only that knob and prints the word back', async (word, value) => {
    const { context, print } = contextWith();

    const outcome = await command.run(`${key} ${word}`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { [key]: value },
    });
    expect(print).toHaveBeenCalledWith(`${key} = ${value ? 'on' : 'off'}`);
  });

  it('refuses a word a boolean does not take, listing every one it does', async () => {
    const { context } = contextWith();

    const outcome = await command.run(`${key} maybe`, context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `${key} takes on|off|true|false|yes|no`,
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
