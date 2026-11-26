/**
 * Tests for the commands that take a post label (WFE-301): every name listed
 * is a command the registry ships, and the words come with the aliases the
 * registry gives them and nothing else.
 */
import { describe, expect, it } from 'vitest';

import { loadDefinitions } from './definitions';
import { POST_TARGET_COMMANDS, postTargetWords } from './postTargets';
import { buildRegistry } from './registry';
import type { Registry } from './types';

/** The registry of every command this bundle ships. */
function shipped(): Registry {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(definitions.error);
  }
  const registry = buildRegistry(definitions.value);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  return registry.value;
}

describe(postTargetWords, () => {
  it('lists only commands that exist', () => {
    const registry = shipped();

    for (const name of POST_TARGET_COMMANDS) {
      expect(registry.byName.get(name)?.name).toBe(name);
    }
  });

  it('adds the aliases of those commands and no other command', () => {
    const words = postTargetWords(shipped());

    expect(['fav', 'f', 'like', 'r', 'wi'].filter((word) => words.has(word))).toHaveLength(5);
    expect(['home', 'h'].filter((word) => words.has(word))).toStrictEqual([]);
  });

  it('is empty for a registry with no commands', () => {
    expect(postTargetWords({ commands: [], byName: new Map() }).size).toBe(0);
  });
});
