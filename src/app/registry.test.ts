/**
 * Tests for the application's one command registry: the real definition files
 * load and index into it, aliases are found, and the work happens once, so
 * every mount reads the same registry.
 */
import { describe, expect, it } from 'vitest';

import { appRegistry } from './registry';
import type { Registry } from '../commands/types';

/** The names the shipped bundle is expected to answer to. */
const EXPECTED = [
  'about',
  'attach',
  'clear',
  'close',
  'compose',
  'composer',
  'connect',
  'copy',
  'detach',
  'federated',
  'help',
  'home',
  'local',
  'more',
  'notifications',
  'open',
  'query',
  'select',
  'tag',
  'thread',
  'whois',
  'win',
];

/** The registry {@link appRegistry} built, throwing when building failed. */
function built(): Registry {
  const result = appRegistry();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe(appRegistry, () => {
  it('indexes every command in src/commands/defs, sorted by name', () => {
    const names = built().commands.map((definition) => definition.name);

    expect(names).toStrictEqual([...names].sort((a, b) => a.localeCompare(b)));

    for (const name of EXPECTED) {
      expect(names).toContain(name);
    }
  });

  it('finds a command by its alias as well as by its name', () => {
    const { byName } = built();

    expect(byName.get('h')?.name).toBe('help');
    expect(byName.get('help')?.name).toBe('help');
    expect(byName.get('sel')?.name).toBe('select');
    expect(byName.get('window')?.name).toBe('win');
    expect(byName.get('fed')?.name).toBe('federated');
  });

  it('answers to the two public timeline windows by the names they are typed as', () => {
    const { byName } = built();

    expect(byName.get('local')?.name).toBe('local');
    expect(byName.get('local')?.usage).toBe('/local');
    expect(byName.get('federated')?.name).toBe('federated');
    expect(byName.get('federated')?.usage).toBe('/federated');
  });

  it('computes the registry once and hands out that one value', () => {
    expect(appRegistry()).toBe(appRegistry());
    expect(built()).toBe(built());
  });
});
