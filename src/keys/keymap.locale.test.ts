/**
 * Tests that the keymap's problem reports follow the language in use
 * (WFE-316, decision 19): a refused binding or override is worded from the
 * catalog, with the command, the chord and the other binding as arguments.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { CommandDefinition, CommandOutcome, Registry } from '../commands/types';
import type { KeyOverride } from '../lib/keyOverride';
import { installFakeLocale } from '../test/i18n';

/** A command called {@link name} binding {@link chords} in {@link mode}. */
function binding(
  name: string,
  mode: 'insert' | 'navigation',
  chords: readonly string[],
): CommandDefinition {
  return {
    name,
    usage: `/${name}`,
    summary: name,
    run: async (): Promise<CommandOutcome> => await Promise.resolve({ ok: true }),
    bindings: chords.map((chord) => ({ mode, chord, args: '' })),
  };
}

/** The registry of {@link commands}. */
function registryOf(...commands: CommandDefinition[]): Registry {
  return { commands, byName: new Map(commands.map((command) => [command.name, command])) };
}

describe('the keymap problems in another language', () => {
  it('words a refused binding from the catalog', () => {
    installFakeLocale({
      keys: {
        invalid_key: 'XX {command} invalid {chord}',
        would_block_typing: 'XX {command} blocks {chord}',
        already_bound: 'XX {command} {chord} taken by {line}',
        conflicts: 'XX {command} {chord} clashes with {other}',
      },
    });
    const registry = registryOf(
      binding('one', 'navigation', ['w', 'ctrl+b']),
      binding('two', 'navigation', ['w', 'w v']),
      binding('three', 'insert', ['x']),
    );

    expect(buildKeymap(registry).problems).toStrictEqual([
      'XX one invalid ctrl+b',
      'XX two w taken by /one',
      'XX two w v clashes with w',
      'XX three blocks x',
    ]);
  });

  it('words a refused override from the catalog', () => {
    installFakeLocale({
      keys: {
        override_invalid_key: 'XX override invalid {chord}',
        override_would_block_typing: 'XX override blocks {chord}',
        override_conflicts: 'XX override {chord} clashes with {other}',
      },
    });
    const overrides: readonly KeyOverride[] = [
      { mode: 'navigation', chord: 'ctrl+b', line: '/one' },
      { mode: 'insert', chord: 'x', line: '/one' },
      { mode: 'navigation', chord: 'w v', line: '/one' },
    ];

    expect(
      buildKeymap(registryOf(binding('one', 'navigation', ['w'])), overrides).problems,
    ).toStrictEqual([
      'XX override invalid ctrl+b',
      'XX override blocks x',
      'XX override w v clashes with w',
    ]);
  });
});
