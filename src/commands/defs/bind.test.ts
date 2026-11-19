/**
 * Tests for /bind: the usage it echoes back when the words spell no binding;
 * a chord the parser refuses answering `Not a key: <chord>`; a line that does
 * not start with `/` being refused; an insert-mode chord that would swallow
 * typing (the keymap's own guard, reached through the context) refused too;
 * and an accepted binding dispatching the settings action with the override —
 * replacing the reader's own for that mode and chord, leaving the rest and
 * the other mode alone — and printing `<mode> <chord> → <line>`. Nothing a
 * refusal touches reaches state.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './bind';
import type { KeyOverride } from '../../lib/keyOverride';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext, CommandOutcome } from '../types';

/** A run that refused nothing; the outcome every accepted call reports. */
const OK: CommandOutcome = { ok: true };

/** Chord text this stub knows, to the canonical chord each spells. */
const CHORDS: ReadonlyMap<string, string> = new Map([
  ['alt+3', 'Alt+3'],
  ['Alt+3', 'Alt+3'],
  ['ctrl+e', 'Ctrl+e'],
  ['F2', 'F2'],
  ['x', 'x'],
  ['f', 'f'],
]);

/** The stub context's keys: the map above is the whole chord language. */
const KEYS: CommandContext['keys'] = {
  parseChord: (text: string): string | null => CHORDS.get(text) ?? null,
  blocksTyping: (chord: string): boolean => chord === 'x',
  keymap: { insert: new Map(), navigation: new Map(), problems: [] },
};

/** A context over a session holding {@link overrides} so far, print recorded. */
function contextWith(overrides: readonly KeyOverride[] = []): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const settings: Settings = { ...DEFAULT_SETTINGS, keyOverrides: overrides };
  const state: AppState = initialAppState(settings);
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state, print, keys: KEYS }), print };
}

/** The keyOverrides list the {@link context} was told to store, or null. */
function dispatchedOverrides(context: CommandContext): readonly KeyOverride[] | null {
  const call = vi
    .mocked(context.dispatch)
    .mock.calls.find(([action]) => action.type === 'settings');
  if (call === undefined) {
    return null;
  }
  const action = call[0];
  return action.type === 'settings' ? (action.settings.keyOverrides ?? null) : null;
}

describe('/bind', () => {
  it('is /bind with no aliases', () => {
    expect(command.name).toBe('bind');
    expect(command.aliases).toBeUndefined();
  });

  it('binds a navigation-mode chord and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('navigation ctrl+e /fav', context);

    expect(outcome).toStrictEqual(OK);
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'Ctrl+e', line: '/fav' },
    ]);
    expect(print).toHaveBeenCalledWith('navigation Ctrl+e → /fav');
  });

  it('keeps the line whole, spaces and all', async () => {
    const { context } = contextWith();

    await command.run('navigation ctrl+e /dm @lain@wired.example hi there', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'Ctrl+e', line: '/dm @lain@wired.example hi there' },
    ]);
  });

  it('stores the canonical chord, whatever spelling was typed', async () => {
    const { context } = contextWith();

    await command.run('insert Alt+3 /win 3', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'Alt+3', line: '/win 3' },
    ]);
  });

  it('accepts a plain printable chord in navigation mode', async () => {
    const { context } = contextWith();

    const outcome = await command.run('navigation f /pin', context);

    expect(outcome).toStrictEqual(OK);
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'f', line: '/pin' },
    ]);
  });

  it('replaces the reader’s own binding for that mode and chord, keeping the rest', async () => {
    const { context } = contextWith([
      { mode: 'navigation', chord: 'Ctrl+e', line: '/fav' },
      { mode: 'insert', chord: 'F2', line: '/help' },
    ]);

    await command.run('navigation ctrl+e /boost', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'F2', line: '/help' },
      { mode: 'navigation', chord: 'Ctrl+e', line: '/boost' },
    ]);
  });

  it('keeps a same-chord binding of the other mode as its own binding', async () => {
    const { context } = contextWith([{ mode: 'navigation', chord: 'f', line: '/fav' }]);

    await command.run('insert f /fav', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'f', line: '/fav' },
      { mode: 'insert', chord: 'f', line: '/fav' },
    ]);
  });

  it('answers not ok for a chord the parser does not know, naming the text', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('navigation banana /help', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not a key: banana' });
    expect(dispatchedOverrides(context)).toBeNull();
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses a line that does not start with a slash', async () => {
    const { context } = contextWith();

    const outcome = await command.run('navigation ctrl+e help me', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'The command line must start with /',
    });
    expect(dispatchedOverrides(context)).toBeNull();
  });

  it('refuses an insert-mode chord that would block typing, naming the chord', async () => {
    const { context } = contextWith();

    const outcome = await command.run('insert x /help', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'x would block typing in insert mode',
    });
    expect(dispatchedOverrides(context)).toBeNull();
  });

  it.each([
    ['nothing at all', ''],
    ['just a mode', 'navigation'],
    ['no line after the chord', 'navigation ctrl+e'],
    ['a mode word that names no mode', 'both ctrl+e /fav'],
  ])('echoes the usage when the words spell no binding — %s', async (_name, args) => {
    const { context } = contextWith();

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Usage: /bind <insert|navigation> <chord> <command line>',
    });
    expect(dispatchedOverrides(context)).toBeNull();
  });

  it('collapses the whitespace between the words', async () => {
    const { context } = contextWith();

    await command.run('   navigation    ctrl+e    /fav   ', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'Ctrl+e', line: '/fav' },
    ]);
  });
});
