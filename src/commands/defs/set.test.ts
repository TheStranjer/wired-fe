/**
 * Tests for /set: no argument prints one `  key = value  — description` line
 * per setting from SETTING_KEYS, in order; a key prints just its line; an
 * unknown key answers `No setting <key>. Try /set`; a value the knob takes
 * dispatches the settings action and prints `key = value` back — booleans
 * normalize on/off/true/false/yes/no to on and off; and a refused word lists
 * the words that would have passed. Nothing a refusal touches reaches state.
 * The theme knob's own turning and listing lives in ./set.theme.test.ts, the
 * density, avatars and images knobs' in ./set.display.test.ts.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './set';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** The listing lines as a default session reads them. */
const LINES = [
  '  avatars = on  — Show author avatars on posts',
  '  clockFormat = 24h  — How timestamps print: 24-hour or 12-hour',
  '  defaultVisibility = public  — The audience new posts aim at by default',
  '  density = cards  — How posts render: as cards or as IRC lines',
  '  effects = off  — The CRT/glitch effects (they never flash)',
  '  expandMedia = off  — Media behind a content warning starts open',
  '  images = on  — Show attachments inline instead of [IMG …] lines',
  '  openIn = here  — Where new windows open: here, vsplit, split, float or hidden',
  '  theme = wired  — The colors the shell is painted in',
];

/** A context over a session whose settings are {@link settings}, print recorded. */
function contextWith(settings: Settings = DEFAULT_SETTINGS): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const state: AppState = initialAppState(settings);
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, print }), print };
}

describe('/set', () => {
  it('is /set with alias /settings', () => {
    expect(command.name).toBe('set');
    expect(command.aliases).toStrictEqual(['settings']);
  });

  it('lists every setting with its value and description when given nothing', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual(LINES.map((line) => [line]));
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('lists the reader’s own values', async () => {
    const { context, print } = contextWith({
      ...DEFAULT_SETTINGS,
      clockFormat: '12h',
      effects: true,
      theme: 'lain',
    });

    await command.run('', context);

    expect(print.mock.calls).toStrictEqual([
      [LINES[0]],
      ['  clockFormat = 12h  — How timestamps print: 24-hour or 12-hour'],
      [LINES[2]],
      [LINES[3]],
      ['  effects = on  — The CRT/glitch effects (they never flash)'],
      [LINES[5]],
      [LINES[6]],
      [LINES[7]],
      ['  theme = lain  — The colors the shell is painted in'],
    ]);
  });

  it('prints the one line of a named setting', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('defaultVisibility', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith(LINES[2]);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('answers not ok for an unknown key, naming it', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('nope', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No setting nope. Try /set' });
    expect(print).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('takes keys case-sensitively', async () => {
    const { context } = contextWith();

    const outcome = await command.run('EFFECTS', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No setting EFFECTS. Try /set' });
  });

  it('sets an enum value, dispatches it and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('clockFormat 12h', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { clockFormat: '12h' },
    });
    expect(print).toHaveBeenCalledWith('clockFormat = 12h');
  });

  it('refuses a value an enum does not list, naming its words', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('clockFormat 36h', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'clockFormat takes 24h|12h' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses an audience the visibility knob does not list for this server', async () => {
    const { context } = contextWith();

    const outcome = await command.run('defaultVisibility everyone', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'defaultVisibility takes public|unlisted|private|direct',
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a word one boolean knob does not take', async () => {
    const { context } = contextWith();

    const outcome = await command.run('effects maybe', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'effects takes on|off|true|false|yes|no',
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['on', true],
    ['true', true],
    ['yes', true],
    ['off', false],
    ['false', false],
    ['no', false],
  ])('reads effects %s as %s and prints the word back', async (word, value) => {
    const { context, print } = contextWith();

    const outcome = await command.run(`effects ${word}`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { effects: value },
    });
    expect(print).toHaveBeenCalledWith(`effects = ${value ? 'on' : 'off'}`);
  });

  it('sets expandMedia and turns only that knob', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('expandMedia yes', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { expandMedia: true },
    });
    expect(print).toHaveBeenCalledWith('expandMedia = on');
  });

  it('refuses a word a boolean does not take, listing every one it does', async () => {
    const { context } = contextWith();

    const outcome = await command.run('expandMedia maybe', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'expandMedia takes on|off|true|false|yes|no',
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('collapses the whitespace between key and value', async () => {
    const { context } = contextWith();

    const outcome = await command.run('   clockFormat    12h  ', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { clockFormat: '12h' },
    });
  });

  it('echoes the usage when a third word arrives', async () => {
    const { context } = contextWith();

    const outcome = await command.run('effects on please', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /set [key [value]]' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
