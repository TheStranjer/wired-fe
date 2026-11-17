/**
 * Tests for /unbind: an override the reader made is dropped — the default
 * stands again — and where there was none, a null-line override is added so
 * the chord stays unbound over every rebuild; either way it dispatches the
 * settings action and prints `<mode> <chord> unbound`. A chord the parser does
 * not know answers `Not a key: <chord>`, and any other shape of words echoes
 * the usage. Refusals touch no state.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './unbind';
import type { KeyOverride } from '../../lib/keyOverride';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext, CommandOutcome } from '../types';

/** A run that refused nothing; the outcome every accepted call reports. */
const OK: CommandOutcome = { ok: true };

/** Chord text this stub knows, to the canonical chord each spells. */
const CHORDS: ReadonlyMap<string, string> = new Map([
  ['ctrl+e', 'Ctrl+e'],
  ['Ctrl+e', 'Ctrl+e'],
  ['f', 'f'],
  ['F2', 'F2'],
]);

/** The stub context's keys: the map above is the whole chord language. */
const KEYS: CommandContext['keys'] = {
  parseChord: (text: string): string | null => CHORDS.get(text) ?? null,
  blocksTyping: (): boolean => false,
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

describe('/unbind', () => {
  it('is /unbind with no aliases', () => {
    expect(command.name).toBe('unbind');
    expect(command.aliases).toStrictEqual([]);
  });

  it('drops the reader’s own override, letting the default stand again', async () => {
    const { context } = contextWith([
      { mode: 'navigation', chord: 'Ctrl+e', line: '/fav' },
      { mode: 'insert', chord: 'F2', line: '/help' },
    ]);

    const outcome = await command.run('navigation Ctrl+e', context);

    expect(outcome).toStrictEqual(OK);
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'F2', line: '/help' },
    ]);
    expect(context.print).toHaveBeenCalledWith('navigation Ctrl+e unbound');
  });

  it('adds a null-line override where no override was, unbinding the default', async () => {
    const { context } = contextWith([{ mode: 'insert', chord: 'F2', line: '/help' }]);

    const outcome = await command.run('navigation f', context);

    expect(outcome).toStrictEqual(OK);
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'F2', line: '/help' },
      { mode: 'navigation', chord: 'f', line: null },
    ]);
    expect(context.print).toHaveBeenCalledWith('navigation f unbound');
  });

  it('unbinds an unbound chord too: the null line keeps it unbound', async () => {
    const { context } = contextWith();

    const outcome = await command.run('insert F2', context);

    expect(outcome).toStrictEqual(OK);
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'F2', line: null },
    ]);
  });

  it('answers not ok for a chord the parser does not know, naming the text', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('navigation banana', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not a key: banana' });
    expect(dispatchedOverrides(context)).toBeNull();
    expect(print).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing at all', ''],
    ['just a mode', 'navigation'],
    ['a mode word that names no mode', 'both f'],
    ['a third word after the chord', 'navigation f now'],
  ])('echoes the usage when the words spell no unbinding — %s', async (_name, args) => {
    const { context } = contextWith();

    const outcome = await command.run(args, context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Usage: /unbind <insert|navigation> <chord>',
    });
    expect(dispatchedOverrides(context)).toBeNull();
  });

  it('collapses the whitespace around the words', async () => {
    const { context } = contextWith();

    await command.run('   navigation    ctrl+e  ', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'Ctrl+e', line: null },
    ]);
  });
});
