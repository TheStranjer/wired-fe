/**
 * The shipped `/postas` keys (WFE-285, decision 6): `Shift+a` in navigation
 * mode and `Ctrl+B A` in both modes run `/postas` with no arguments, which
 * opens the picker; the keymap builds with no problems and `/binds` lists them.
 */
import { describe, expect, it, vi } from 'vitest';

import { buildKeymap } from './keymap';
import type { Keymap } from '../commands/bindingTypes';
import { loadDefinitions } from '../commands/definitions';
import { command as binds } from '../commands/defs/binds';
import { buildRegistry } from '../commands/registry';
import type { CommandContext } from '../commands/types';
import { fakeCommandContext } from '../test/commandContext';

/** The keymap the shipped defs folder produces, throwing when it fails. */
function shippedKeymap(): Keymap {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(`loadDefinitions rejected the defs folder: ${definitions.error}`);
  }
  const registry = buildRegistry(definitions.value);
  if (!registry.ok) {
    throw new Error(`buildRegistry rejected the definitions: ${registry.error}`);
  }
  return buildKeymap(registry.value);
}

const RUNS_POSTAS = { line: '/postas', prefill: false };

describe('the /postas keys', () => {
  it('build a keymap with no problems', () => {
    expect(shippedKeymap().problems).toStrictEqual([]);
  });

  it('bind Shift+a in navigation mode only', () => {
    const { insert, navigation } = shippedKeymap();

    expect(navigation.get('Shift+a')).toStrictEqual(RUNS_POSTAS);
    expect(insert.has('Shift+a')).toBe(false);
  });

  it('bind Ctrl+b Shift+a in both modes', () => {
    const { insert, navigation } = shippedKeymap();

    expect(insert.get('Ctrl+b Shift+a')).toStrictEqual(RUNS_POSTAS);
    expect(navigation.get('Ctrl+b Shift+a')).toStrictEqual(RUNS_POSTAS);
  });

  it('are listed by /binds', async () => {
    const print = vi.fn<CommandContext['print']>();
    const keys: CommandContext['keys'] = {
      parseChord: (text) => text,
      blocksTyping: () => false,
      keymap: shippedKeymap(),
    };

    await binds.run('', fakeCommandContext({ print, keys }));

    const lines = print.mock.calls.map(([text]) => text);

    expect(lines).toContain('  Shift+a  /postas');
    expect(lines.filter((line) => line === '  Ctrl+b Shift+a  /postas')).toHaveLength(2);
  });
});
