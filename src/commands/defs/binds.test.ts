/**
 * Tests for /binds: the effective bindings printed grouped by mode — insert
 * first — sorted by chord, `  <chord>  <line>` with a `(prefill)` tag where a
 * binding fills the command line; one argument limits the listing to that
 * mode; an empty mode prints `(none)` under its header; a word that names no
 * mode answers Not a mode and a third word echoes the usage.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './binds';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext, CommandOutcome, Keymap } from '../types';

/** A run that printed what was asked; nothing else to report. */
const OK: CommandOutcome = { ok: true };

/** The effective keymap these tests hand the context, unsorted per mode. */
const KEYMAP: Keymap = {
  insert: new Map([
    ['F1', { line: '/help', prefill: false }],
    ['Alt+3', { line: '/win 3', prefill: false }],
  ]),
  navigation: new Map([
    ['j', { line: '/next', prefill: false }],
    ['?', { line: '/help', prefill: false }],
    ['f', { line: '/fav', prefill: false }],
    ['Ctrl+e', { line: '/reply {label}', prefill: true }],
  ]),
  problems: [],
};

/** A keymap with only {@link entries} in {@link mode}, the other mode empty. */
function oneMode(mode: 'insert' | 'navigation', entries: readonly (readonly string[])[]): Keymap {
  const map = new Map(entries.map(([chord, line]) => [chord, { line, prefill: false }]));
  return {
    insert: mode === 'insert' ? map : new Map(),
    navigation: mode === 'navigation' ? map : new Map(),
    problems: [],
  };
}

/** A context whose keys carry {@link keymap}, print recorded. */
function contextWith(keymap: Keymap = KEYMAP): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  const keys: CommandContext['keys'] = {
    parseChord: (text: string): string | null => (text === '' ? null : text),
    blocksTyping: (): boolean => false,
    keymap,
  };
  return { context: fakeCommandContext({ print, keys }), print };
}

/** Everything the {@link print} mock was called with, in order. */
function printed(print: Mock<CommandContext['print']>): readonly string[] {
  return print.mock.calls.map(([text]) => text);
}

describe('/binds', () => {
  it('is /binds with alias /keys', () => {
    expect(command.name).toBe('binds');
    expect(command.aliases).toStrictEqual(['keys']);
  });

  it('prints both modes, insert first, each sorted by chord', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual(OK);
    expect(printed(print)).toStrictEqual([
      'Keys (insert mode):',
      '  Alt+3  /win 3',
      '  F1  /help',
      'Keys (navigation mode):',
      '  ?  /help',
      '  Ctrl+e  /reply {label} (prefill)',
      '  f  /fav',
      '  j  /next',
    ]);
  });

  it('lists one mode when its word names it', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('insert', context);

    expect(outcome).toStrictEqual(OK);
    expect(printed(print)).toStrictEqual(['Keys (insert mode):', '  Alt+3  /win 3', '  F1  /help']);
  });

  it('prints a key sequence as its chords joined by spaces', async () => {
    const { context, print } = contextWith(
      oneMode('navigation', [
        ['w v', '/vsplit'],
        ['Ctrl+b %', '/vsplit'],
      ]),
    );

    await command.run('navigation', context);

    expect(printed(print)).toStrictEqual([
      'Keys (navigation mode):',
      '  Ctrl+b %  /vsplit',
      '  w v  /vsplit',
    ]);
  });

  it('says (none) for a mode with nothing bound', async () => {
    const { context, print } = contextWith(oneMode('insert', [['F1', '/help']]));

    await command.run('', context);

    expect(printed(print)).toStrictEqual([
      'Keys (insert mode):',
      '  F1  /help',
      'Keys (navigation mode):',
      '  (none)',
    ]);
  });

  it('says (none) for both modes when nothing is bound at all', async () => {
    const { context, print } = contextWith(oneMode('insert', []));

    await command.run('', context);

    expect(printed(print)).toStrictEqual([
      'Keys (insert mode):',
      '  (none)',
      'Keys (navigation mode):',
      '  (none)',
    ]);
  });

  it('answers not ok for a word that names no mode', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('both', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not a mode: both. Try /binds' });
    expect(print).not.toHaveBeenCalled();
  });

  it('echoes the usage when a second word arrives', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('insert now', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /binds [insert|navigation]' });
    expect(print).not.toHaveBeenCalled();
  });
});
