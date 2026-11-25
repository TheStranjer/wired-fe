/**
 * Tests for the command registry: sorting, indexing, and the validation that
 * makes a broken definition file fail loudly.
 */
import { describe, expect, it } from 'vitest';

import type { BindingMode, CommandBinding } from './bindingTypes';
import { buildRegistry, lookupCommand } from './registry';
import type { CommandContext, CommandDefinition, CommandOutcome, Registry } from './types';
import { err } from '../lib/result';

/** A fixture definition whose handler prints a line and reports {@link outcome}. */
function definition(
  name: string,
  aliases: readonly string[] = [],
  outcome: CommandOutcome = { ok: true },
): CommandDefinition {
  return {
    name,
    aliases,
    usage: `/${name}`,
    summary: `Do the ${name} thing.`,
    run: async (_args: string, context: CommandContext): Promise<CommandOutcome> => {
      context.print(`${name} ran`);

      return await Promise.resolve(outcome);
    },
  };
}

/** The registry built from definitions these tests consider valid. */
function built(definitions: readonly CommandDefinition[]): Registry {
  const result = buildRegistry(definitions);
  if (!result.ok) {
    throw new Error(`buildRegistry unexpectedly rejected definitions: ${result.error}`);
  }
  return result.value;
}

/** The two binding modes, as the tests below name them. */
const INSERT: BindingMode = 'insert';
const NAVIGATION: BindingMode = 'navigation';

/** A fixture definition for {@link name} declaring default {@link bindings}. */
function withBindings(name: string, bindings: readonly CommandBinding[]): CommandDefinition {
  return { ...definition(name), bindings };
}

describe(buildRegistry, () => {
  it('builds an empty registry from no definitions', () => {
    const registry = built([]);

    expect(registry.commands).toStrictEqual([]);
    expect(registry.byName.size).toBe(0);
  });

  it('collects every definition sorted by name', () => {
    const registry = built([definition('win'), definition('fav'), definition('dm')]);

    expect(registry.commands.map((command) => command.name)).toStrictEqual(['dm', 'fav', 'win']);
  });

  it('indexes names and aliases in registration order', () => {
    const win = definition('win', ['window', 'w']);
    const registry = built([win]);

    expect([...registry.byName.keys()]).toStrictEqual(['win', 'window', 'w']);
    expect(registry.byName.get('window')).toBe(win);
  });

  it('accepts distinct names and aliases across commands', () => {
    const registry = built([definition('win', ['w']), definition('fav', ['f'])]);

    expect(registry.byName.size).toBe(4);
  });

  it('rejects names that do not match the pattern, naming the offender', () => {
    expect(buildRegistry([definition('9lives')])).toStrictEqual(
      err('Invalid name: /9lives (in command /9lives)'),
    );
    expect(buildRegistry([definition('Win')])).toStrictEqual(
      err('Invalid name: /Win (in command /Win)'),
    );
  });

  it('rejects aliases that do not match the pattern, naming the offender', () => {
    expect(buildRegistry([definition('fav', ['f@v'])])).toStrictEqual(
      err('Invalid alias: /f@v (in command /fav)'),
    );
  });

  it('rejects two commands sharing a name', () => {
    expect(buildRegistry([definition('win'), definition('win')])).toStrictEqual(
      err('Duplicate name: /win (already used by /win)'),
    );
  });

  it('rejects an alias equal to any command name', () => {
    expect(buildRegistry([definition('win', ['w']), definition('w')])).toStrictEqual(
      err('Duplicate name: /w (already used by /win)'),
    );
  });

  it('rejects an alias equal to another command alias', () => {
    expect(buildRegistry([definition('win', ['w']), definition('wm', ['w'])])).toStrictEqual(
      err('Duplicate name: /w (already used by /win)'),
    );
  });

  it('rejects an alias equal to its own name', () => {
    expect(buildRegistry([definition('fav', ['fav'])])).toStrictEqual(
      err('Duplicate name: /fav (already used by /fav)'),
    );
  });

  it('builds a definition that declares bindings', () => {
    const win = withBindings('win', [{ mode: NAVIGATION, chord: 'Alt+3', args: '3' }]);
    const registry = built([win]);

    expect(registry.byName.get('win')).toBe(win);
    expect(registry.commands[0]?.bindings).toStrictEqual(win.bindings);
  });

  it('rejects the same mode and chord twice in one definition, naming command and chord', () => {
    const win = withBindings('win', [
      { mode: NAVIGATION, chord: 'Alt+3', args: '3' },
      { mode: NAVIGATION, chord: 'Alt+3', args: '' },
    ]);

    expect(buildRegistry([win])).toStrictEqual(
      err('Duplicate binding: Alt+3 in navigation mode (command /win)'),
    );
  });

  it('accepts the same chord in two different modes of one definition', () => {
    const win = withBindings('win', [
      { mode: INSERT, chord: 'Alt+3', args: '3' },
      { mode: NAVIGATION, chord: 'Alt+3', args: '3' },
    ]);

    expect(built([win]).commands).toHaveLength(1);
  });

  it('accepts one command repeating a chord another command binds', () => {
    const registry = built([
      withBindings('next', [{ mode: NAVIGATION, chord: 'j', args: '' }]),
      withBindings('follow', [{ mode: NAVIGATION, chord: 'j', args: '' }]),
    ]);

    expect(registry.commands.map((command) => command.name)).toStrictEqual(['follow', 'next']);
  });
});

describe(lookupCommand, () => {
  it('finds a command by name and by alias', () => {
    const win = definition('win', ['window']);
    const registry = built([definition('dm'), win]);

    expect(lookupCommand(registry, 'win')).toBe(win);
    expect(lookupCommand(registry, 'window')).toBe(win);
  });

  it('returns undefined for unknown names, looking up case-sensitively', () => {
    const registry = built([definition('win')]);

    expect(lookupCommand(registry, 'nope')).toBeUndefined();
    expect(lookupCommand(registry, 'Win')).toBeUndefined();
  });
});
