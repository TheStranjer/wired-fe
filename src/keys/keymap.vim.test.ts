/**
 * The shipped vim-style layout keys (decision 18): in navigation mode a bare
 * `w` is the window prefix, so every `w …` sequence maps to its layout command
 * and the keymap builds with no problems; `/whois` moved to `Shift+w`.
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

/** Each navigation sequence and the line it runs. */
const SEQUENCES: readonly (readonly [string, string])[] = [
  ['w v', '/vsplit'],
  ['w s', '/split'],
  ['w h', '/focus left'],
  ['w j', '/focus down'],
  ['w k', '/focus up'],
  ['w l', '/focus right'],
  ['w w', '/focus next'],
  ['w c', '/unsplit'],
  ['w o', '/only'],
  ['w =', '/equalize'],
  ['w f', '/float'],
  ['w d', '/dock'],
  ['w x', '/swap right'],
];

describe('the vim-style layout keys', () => {
  it('build a keymap with no problems', () => {
    expect(shippedKeymap().problems).toStrictEqual([]);
  });

  it.each(SEQUENCES)('bind %s to %s in navigation mode', (sequence, line) => {
    expect(shippedKeymap().navigation.get(sequence)).toStrictEqual({ line, prefill: false });
  });

  it('leave a bare w unbound and move /whois to Shift+w', () => {
    const { navigation } = shippedKeymap();

    expect(navigation.has('w')).toBe(false);
    expect(navigation.get('Shift+w')).toStrictEqual({ line: '/whois', prefill: false });
  });

  it('do not reach insert mode', () => {
    expect(shippedKeymap().insert.has('w v')).toBe(false);
  });
});
