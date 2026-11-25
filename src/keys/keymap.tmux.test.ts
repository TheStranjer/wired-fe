/**
 * The shipped tmux-style layout keys (decision 18): `Ctrl+B` then `%`, `"`,
 * arrows, `o`, `x`, `z`, `f`, `d`, `c`, `n`, `p` or a digit, in both modes,
 * with no problem reported by the keymap.
 */
import { describe, expect, it } from 'vitest';

import { buildKeymap } from './keymap';
import type { Keymap } from '../commands/bindingTypes';
import { loadDefinitions } from '../commands/definitions';
import { buildRegistry } from '../commands/registry';

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

/** Every `Ctrl+B` sequence and the line it runs. */
const SEQUENCES: readonly (readonly [string, string])[] = [
  ['%', '/vsplit'],
  ['"', '/split'],
  ['ArrowLeft', '/focus left'],
  ['ArrowRight', '/focus right'],
  ['ArrowUp', '/focus up'],
  ['ArrowDown', '/focus down'],
  ['o', '/focus next'],
  ['x', '/unsplit'],
  ['z', '/only'],
  ['f', '/float'],
  ['d', '/dock'],
  ['c', '/desktop new'],
  ['n', '/desktop next'],
  ['p', '/desktop prev'],
  ['0', '/desktop 10'],
  ...Array.from({ length: 9 }, (_, index): readonly [string, string] => [
    String(index + 1),
    `/desktop ${String(index + 1)}`,
  ]),
];

describe('the tmux-style layout keys', () => {
  it('build a keymap with no problems', () => {
    expect(shippedKeymap().problems).toStrictEqual([]);
  });

  it.each(SEQUENCES)('Ctrl+b %s runs %s in both modes', (key, line) => {
    const { insert, navigation } = shippedKeymap();
    const entry = { line, prefill: false };

    expect(insert.get(`Ctrl+b ${key}`)).toStrictEqual(entry);
    expect(navigation.get(`Ctrl+b ${key}`)).toStrictEqual(entry);
  });
});
