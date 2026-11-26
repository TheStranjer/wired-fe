/**
 * Tests for the command provider: the slash prefix and the first word only,
 * names and aliases from the registry sorted, and the engine completing `/he`
 * into `/help ` with it.
 */
import { describe, expect, it } from 'vitest';

import { commandProvider } from './commandProvider';
import { type CompletionState, cycleCompletion, startCompletion } from './complete';
import type { CommandDefinition, CommandOutcome, Registry } from './types';

/** What the fixture commands report: completion never runs them. */
const OK: CommandOutcome = { ok: true };

/** A command definition that does nothing: the provider reads names and aliases only. */
function command(name: string, aliases: readonly string[] = []): CommandDefinition {
  return {
    name,
    aliases,
    usage: `/${name}`,
    summary: `Do the ${name} thing.`,
    run: async (): Promise<CommandOutcome> => await Promise.resolve(OK),
  };
}

/** A registry over {@link definitions}, indexed the way buildRegistry would, in the order given. */
function registryWith(definitions: readonly CommandDefinition[]): Registry {
  const byName = new Map<string, CommandDefinition>();
  for (const definition of definitions) {
    for (const label of [definition.name, ...(definition.aliases ?? [])]) {
      byName.set(label, definition);
    }
  }
  return { commands: definitions, byName };
}

/** Commands, names and aliases, deliberately not sorted: the provider sorts its own list. */
const REGISTRY = registryWith([
  command('win', ['w']),
  command('help', ['h']),
  command('clear'),
  command('close'),
  command('about'),
]);

/** Every command word of {@link REGISTRY}, in the order completion offers them. */
const ALL_WORDS = ['/about', '/clear', '/close', '/h', '/help', '/w', '/win'];

/** The provider under test. */
const COMMANDS = commandProvider(REGISTRY);

/** The completion the engine finds with the command provider, or the failure tests reject. */
function completed(
  text: string,
  cursor: number,
): {
  readonly text: string;
  readonly cursor: number;
  readonly state: CompletionState;
} {
  const result = startCompletion(text, cursor, [COMMANDS]);
  if (result === null) {
    throw new Error(`startCompletion found nothing to complete in ${text}`);
  }
  return result;
}

describe(commandProvider, () => {
  it('accepts a first word that starts with a slash', () => {
    expect(COMMANDS.accepts('/he', true)).toBe(true);
    expect(COMMANDS.accepts('/', true)).toBe(true);
  });

  it('refuses words without the slash and a slash anywhere but first', () => {
    expect(COMMANDS.accepts('he', true)).toBe(false);
    expect(COMMANDS.accepts('@lain', true)).toBe(false);
    expect(COMMANDS.accepts('/he', false)).toBe(false);
  });

  it('offers the names and the aliases that start with the typed prefix, sorted', () => {
    expect(COMMANDS.candidates('/h')).toStrictEqual(['/h', '/help']);
    expect(COMMANDS.candidates('/w')).toStrictEqual(['/w', '/win']);
    expect(COMMANDS.candidates('/cl')).toStrictEqual(['/clear', '/close']);
  });

  it('offers every command word for a bare slash, sorted', () => {
    expect(COMMANDS.candidates('/')).toStrictEqual(ALL_WORDS);
  });

  it('matches the typed prefix whatever case it is in', () => {
    expect(COMMANDS.candidates('/HE')).toStrictEqual(['/help']);
  });

  it('offers nothing for a prefix no command or alias has', () => {
    expect(COMMANDS.candidates('/x')).toStrictEqual([]);
  });
});

describe('the command provider on the command line', () => {
  it('completes /he into /help with nothing else to cycle', () => {
    expect(startCompletion('/he', 3, [COMMANDS])).toStrictEqual({
      text: '/help ',
      cursor: 6,
      state: { original: '/he', cursor: 3, candidates: ['/help'], index: 0, wordStart: 0 },
    });
  });

  it('completes a command name typed in capitals', () => {
    expect(completed('/HELP', 5).text).toBe('/help ');
  });

  it('completes an alias and cycles to the longer name', () => {
    expect(completed('/w', 2)).toStrictEqual({
      text: '/w ',
      cursor: 3,
      state: { original: '/w', cursor: 2, candidates: ['/w', '/win'], index: 0, wordStart: 0 },
    });

    expect(cycleCompletion(completed('/w', 2).state, 1).text).toBe('/win ');
  });

  it('offers every command for a bare slash and cycles through them', () => {
    const first = completed('/', 1);

    expect(first.text).toBe('/about ');
    expect(first.state.candidates).toStrictEqual(ALL_WORDS);
    expect(cycleCompletion(first.state, 1).text).toBe('/clear ');
  });

  it('returns null for a slash word that is not the first word', () => {
    expect(startCompletion('/dm /he', 7, [COMMANDS])).toBeNull();
  });

  it('returns null when no command starts with what was typed', () => {
    expect(startCompletion('/zz', 3, [COMMANDS])).toBeNull();
  });
});
