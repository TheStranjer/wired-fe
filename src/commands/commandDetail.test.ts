/**
 * Tests for the detail block of a command (WFE-311): usage and summary always,
 * the usage a backend rewrote (`usageFor`, applied by the available registry),
 * aliases when there are some, and the keys of the effective keymap — default
 * and rebound, in both modes, found by name or alias — with nothing extra for
 * a command that has none of them.
 */
import { describe, expect, it } from 'vitest';

import { availableCommands } from './available';
import type { Keymap } from './bindingTypes';
import { commandDetail, commandDetailLines, commandTip } from './commandDetail';
import type { CommandDefinition, CommandOutcome } from './types';
import type { Capabilities } from '../capabilities/capabilities';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../capabilities/testCapabilities';
import { EMPTY_KEYMAP } from '../test/commandContext';

/** A command with nothing but a usage and a summary. */
const PLAIN: CommandDefinition = {
  name: 'plain',
  usage: '/plain <thing>',
  summary: 'Do a plain thing',
  run: async (): Promise<CommandOutcome> => await Promise.resolve({ ok: true }),
};

/** A command with two aliases. */
const ALIASED: CommandDefinition = { ...PLAIN, name: 'float', aliases: ['fl', 'fw'] };

/** A keymap with {@link insert} and {@link navigation} chords, each mapped to its line. */
function keymapOf(
  insert: readonly (readonly [string, string])[],
  navigation: readonly (readonly [string, string])[],
): Keymap {
  const entries = (pairs: readonly (readonly [string, string])[]): Keymap['insert'] =>
    new Map(pairs.map(([chord, line]) => [chord, { line, prefill: false }]));
  return { insert: entries(insert), navigation: entries(navigation), problems: [] };
}

describe(commandDetail, () => {
  it('is the usage and the summary for a command with no aliases and no keys', () => {
    expect(commandDetail(PLAIN, EMPTY_KEYMAP)).toBe('/plain <thing>\n  Do a plain thing');
    expect(commandDetailLines(PLAIN, EMPTY_KEYMAP)).toStrictEqual([
      '/plain <thing>',
      '  Do a plain thing',
    ]);
  });

  it('lists the aliases', () => {
    expect(commandDetailLines(ALIASED, EMPTY_KEYMAP)[2]).toBe('  Aliases: /fl, /fw');
  });

  it('lists the keys of both modes, insert first, whatever arguments the line has', () => {
    const keymap = keymapOf(
      [['Alt+f', '/float']],
      [
        ['f', '/float focus'],
        ['g', '/other'],
      ],
    );

    expect(commandDetailLines(ALIASED, keymap)).toStrictEqual([
      '/plain <thing>',
      '  Do a plain thing',
      '  Aliases: /fl, /fw',
      '  Keys: Alt+f (insert), f (navigation)',
    ]);
  });

  it('finds a key rebound to one of its aliases', () => {
    const keymap = keymapOf([], [['q', '/fl']]);

    expect(commandDetail(ALIASED, keymap)).toContain('  Keys: q (navigation)');
  });

  it('does not mistake a command whose name starts the same for it', () => {
    const keymap = keymapOf([], [['q', '/floating']]);

    expect(commandDetail(ALIASED, keymap)).not.toContain('Keys');
  });

  it('shows the usage of the backend, as the available registry rewrites it', () => {
    const gated: CommandDefinition = {
      ...PLAIN,
      usageFor: (capabilities) => (capabilities === WIRED_CAPABILITIES ? '/plain wired' : '/plain'),
    };
    const detailOn = (capabilities: Capabilities): string => {
      const registry = { commands: [gated], byName: new Map() };
      const { commands } = availableCommands(registry, { signedIn: true, capabilities });
      return commands.map((command) => commandDetail(command, EMPTY_KEYMAP)).join('');
    };

    expect(detailOn(WIRED_CAPABILITIES)).toMatch(/^\/plain wired\n/u);
    expect(detailOn(MASTODON_CAPABILITIES)).toMatch(/^\/plain\n/u);
  });
});

describe(commandTip, () => {
  const registry = { commands: [ALIASED], byName: new Map([['float', ALIASED]]) };

  it('words the action, the command and the distinct chords of both modes', () => {
    const keymap = keymapOf(
      [['Ctrl+b f', '/float']],
      [
        ['Ctrl+b f', '/float'],
        ['w f', '/float'],
      ],
    );

    expect(commandTip('Tear off', 'float', { registry, keymap })).toBe(
      'Tear off: /float (Ctrl+b f, w f)',
    );
  });

  it('shows the command alone when nothing is bound to it', () => {
    expect(commandTip('Tear off', 'float', { registry, keymap: EMPTY_KEYMAP })).toBe(
      'Tear off: /float',
    );
  });

  it('looks the command up by the first word of what it shows', () => {
    const keymap = keymapOf([], [['e', '/float edit']]);

    expect(commandTip('Edit', 'float edit', { registry, keymap })).toBe('Edit: /float edit (e)');
  });

  it('shows no keys for a command the registry lacks', () => {
    const keymap = keymapOf([], [['f', '/float']]);
    const empty = { commands: [], byName: new Map() };

    expect(commandTip('Tear off', 'float', { registry: empty, keymap })).toBe('Tear off: /float');
  });
});
