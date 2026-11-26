/**
 * The shipped `/attach` keys (WFE-288, decision 6): `Shift+i` in navigation
 * mode and `Ctrl+B I` in both modes run `/attach` with no alt text, the keymap
 * builds with no problems, and `/binds` lists them.
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

const RUNS_ATTACH = { line: '/attach', prefill: false };

describe('the /attach keys', () => {
  it('build a keymap with no problems', () => {
    expect(shippedKeymap().problems).toStrictEqual([]);
  });

  it('bind Shift+i in navigation mode only', () => {
    const { insert, navigation } = shippedKeymap();

    expect(navigation.get('Shift+i')).toStrictEqual(RUNS_ATTACH);
    expect(insert.has('Shift+i')).toBe(false);
  });

  it('bind Ctrl+b Shift+i in both modes', () => {
    const { insert, navigation } = shippedKeymap();

    expect(insert.get('Ctrl+b Shift+i')).toStrictEqual(RUNS_ATTACH);
    expect(navigation.get('Ctrl+b Shift+i')).toStrictEqual(RUNS_ATTACH);
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

    expect(lines).toContain('  Shift+i  /attach');
    expect(lines.filter((line) => line === '  Ctrl+b Shift+i  /attach')).toHaveLength(2);
  });
});
