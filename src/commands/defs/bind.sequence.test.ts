/**
 * Tests for /bind with key sequences (decision 18): the chords are the words
 * before the first one starting with `/` and are parsed as one sequence, the
 * rest is the command line; a lone `/` is still a chord when it comes first;
 * and a sequence naming a non-key is refused whole.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './bind';
import type { KeyOverride } from '../../lib/keyOverride';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** Sequence text this stub knows, to the canonical sequence each spells. */
const SEQUENCES: ReadonlyMap<string, string> = new Map([
  ['w v', 'w v'],
  ['ctrl+b %', 'Ctrl+b %'],
  ['/', '/'],
]);

/** The stub context's keys: the map above is the whole chord language. */
const KEYS: CommandContext['keys'] = {
  parseChord: (text: string): string | null => SEQUENCES.get(text) ?? null,
  blocksTyping: (): boolean => false,
  keymap: { insert: new Map(), navigation: new Map(), problems: [] },
};

/** A context over those keys, print recorded. */
function contextWithKeys(): CommandContext {
  return fakeCommandContext({ print: vi.fn(), keys: KEYS });
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

describe('/bind with a key sequence', () => {
  it('binds the words before the first slash word as one sequence', async () => {
    const context = contextWithKeys();

    const outcome = await command.run('navigation w v /vsplit feed main', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: 'w v', line: '/vsplit feed main' },
    ]);
    expect(context.print).toHaveBeenCalledWith('navigation w v → /vsplit feed main');
  });

  it('binds a modified prefix in insert mode', async () => {
    const context = contextWithKeys();

    await command.run('insert ctrl+b % /vsplit', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'insert', chord: 'Ctrl+b %', line: '/vsplit' },
    ]);
  });

  it('takes a lone slash as the first chord', async () => {
    const context = contextWithKeys();

    await command.run('navigation / /help', context);

    expect(dispatchedOverrides(context)).toStrictEqual([
      { mode: 'navigation', chord: '/', line: '/help' },
    ]);
  });

  it('names the whole sequence when one of its chords is no key', async () => {
    const context = contextWithKeys();

    const outcome = await command.run('navigation w banana /help', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Not a key: w banana' });
    expect(dispatchedOverrides(context)).toBeNull();
  });
});
