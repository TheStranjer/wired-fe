/**
 * Tests for the rows the command provider describes (WFE-297): the main name
 * with its aliases beside it and the summary of the registry entry, the same
 * for the name and for any alias, nothing for a word that is no command.
 */
import { describe, expect, it } from 'vitest';

import { commandProvider } from './commandProvider';
import type { CommandDefinition, CommandOutcome, Registry } from './types';
import { EMPTY_KEYMAP } from '../test/commandContext';

/** What the fixture commands report: nothing here runs them. */
const OK: CommandOutcome = { ok: true };

/** A command that does nothing, with the summary the list should show. */
function command(name: string, aliases?: readonly string[]): CommandDefinition {
  const base = {
    name,
    usage: `/${name}`,
    summary: `Summary of ${name}`,
    run: async (): Promise<CommandOutcome> => await Promise.resolve(OK),
  };
  return aliases === undefined ? base : { ...base, aliases };
}

/** A registry over {@link definitions}. */
function registryWith(definitions: readonly CommandDefinition[]): Registry {
  return { commands: definitions, byName: new Map() };
}

/** The provider over a command without aliases, one with one and one with two. */
const PROVIDER = commandProvider(
  registryWith([command('clear'), command('help', ['h']), command('whois', ['wi', 'profile'])]),
  { ...EMPTY_KEYMAP, navigation: new Map([['x', { line: '/clear', prefill: false }]]) },
);

describe('commandProvider describe', () => {
  it('describes a command by its name, with the summary of its registry entry', () => {
    expect(PROVIDER.describe?.('/clear')).toStrictEqual({
      word: '/clear',
      label: '/clear',
      description: 'Summary of clear',
      detail: '/clear\n  Summary of clear\n  Keys: x (navigation)',
    });
  });

  it('writes the aliases beside the main name', () => {
    expect(PROVIDER.describe?.('/help')).toStrictEqual({
      word: '/help',
      label: '/help (/h)',
      description: 'Summary of help',
      detail: '/help\n  Summary of help\n  Aliases: /h',
    });
    expect(PROVIDER.describe?.('/whois')?.label).toBe('/whois (/wi, /profile)');
  });

  it('describes an alias as its main name', () => {
    expect(PROVIDER.describe?.('/h')).toStrictEqual(PROVIDER.describe?.('/help'));
    expect(PROVIDER.describe?.('/profile')?.word).toBe('/whois');
  });

  it('has nothing to say about a word that is no command', () => {
    expect(PROVIDER.describe?.('/nope')).toBeUndefined();
  });
});
