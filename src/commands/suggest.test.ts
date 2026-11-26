/**
 * Tests for the suggestion rows (WFE-297): the list narrows with the typed
 * prefix, matches aliases and shows them beside the main name, takes its
 * descriptions from the registry, returns every row however many there are
 * (WFE-306), closes where the line has no command word under the caret, and
 * follows a Tab completion in progress, highlighting the row of the candidate
 * in the line.
 */
import { describe, expect, it } from 'vitest';

import { commandProvider } from './commandProvider';
import { type Provider, cycleCompletion, startCompletion } from './complete';
import { suggestionView } from './suggest';
import type { CommandDefinition, CommandOutcome, Registry } from './types';

/** What the fixture commands report: nothing here runs them. */
const OK: CommandOutcome = { ok: true };

/** A command that does nothing, with a summary of its own. */
function command(name: string, aliases: readonly string[] = []): CommandDefinition {
  return {
    name,
    aliases,
    usage: `/${name}`,
    summary: `Summary of ${name}`,
    run: async (): Promise<CommandOutcome> => await Promise.resolve(OK),
  };
}

/** A registry over {@link definitions}, as buildRegistry would index it. */
function registryWith(definitions: readonly CommandDefinition[]): Registry {
  const byName = new Map<string, CommandDefinition>();
  for (const definition of definitions) {
    for (const label of [definition.name, ...(definition.aliases ?? [])]) {
      byName.set(label, definition);
    }
  }
  return { commands: definitions, byName };
}

/** The commands under test: `help` and `home` have aliases, `host` and `clear` do not. */
const PROVIDER = commandProvider(
  registryWith([
    command('home', ['hm']),
    command('help', ['h']),
    command('host'),
    command('clear'),
  ]),
);

/** How many commands {@link MANY} has: more than the eight rows the list shows at once. */
const MANY_COUNT = 10;

/** Ten commands, `c0` to `c9`, to overflow the list. */
const MANY = commandProvider(
  registryWith(Array.from({ length: MANY_COUNT }, (_, index) => command(`c${String(index)}`))),
);

/** The list for {@link text} with the caret at {@link cursor}, over {@link provider}. */
function viewAt(
  text: string,
  cursor: number,
  provider: Provider = PROVIDER,
): ReturnType<typeof suggestionView> {
  return suggestionView({ text, cursor }, [provider], null);
}

/** The labels of the rows the list shows for {@link text} with the caret at its end. */
function labels(text: string): readonly string[] | undefined {
  return viewAt(text, text.length)?.rows.map((row) => row.label);
}

/** The list after Tab started a completion of {@link text} and {@link steps} more cycled it. */
function tabbed(text: string, provider: Provider, steps: 1 | -1 | 0) {
  const started = startCompletion(text, text.length, [provider]);
  const shown = started !== null && steps !== 0 ? cycleCompletion(started.state, steps) : started;
  return {
    line: shown?.text,
    view:
      shown === null
        ? null
        : suggestionView({ text: shown.text, cursor: shown.cursor }, [provider], shown.state),
  };
}

describe(suggestionView, () => {
  it('lists every command for a bare slash, sorted', () => {
    expect(labels('/')).toStrictEqual(['/clear', '/help (/h)', '/home (/hm)', '/host']);
  });

  it('narrows as the word is typed', () => {
    expect(labels('/h')).toStrictEqual(['/help (/h)', '/home (/hm)', '/host']);
    expect(labels('/ho')).toStrictEqual(['/home (/hm)', '/host']);
    expect(labels('/hom')).toStrictEqual(['/home (/hm)']);
  });

  it('matches on an alias and lists its command once, beside its main name', () => {
    expect(labels('/hm')).toStrictEqual(['/home (/hm)']);
    expect(viewAt('/h', 2)?.rows.map((row) => row.words)).toStrictEqual([
      ['/h', '/help'],
      ['/hm', '/home'],
      ['/host'],
    ]);
  });

  it('describes each row with the summary of its registry entry', () => {
    const rows = viewAt('/ho', 3)?.rows;

    expect(rows?.map((row) => [row.word, row.description])).toStrictEqual([
      ['/home', 'Summary of home'],
      ['/host', 'Summary of host'],
    ]);
  });

  it('matches the word the caret is in, not the whole line', () => {
    expect(viewAt('/home', 3)?.rows.map((row) => row.word)).toStrictEqual(['/home', '/host']);
  });

  it('is closed with no command word under the caret', () => {
    expect(labels('')).toBeUndefined();
    expect(labels('hello')).toBeUndefined();
    expect(labels('/home ')).toBeUndefined();
  });

  it('is closed where the word is not the first or has no command', () => {
    expect(labels('say /ho')).toBeUndefined();
    expect(labels('/nope')).toBeUndefined();
    expect(viewAt('/home x', 0)).toBeNull();
  });

  it('is closed for providers that describe nothing', () => {
    const plain: Provider = { accepts: () => true, candidates: () => ['/a'] };

    expect(viewAt('/a', 2, plain)).toBeNull();
  });

  it('shows a word the provider cannot describe as itself', () => {
    const bare: Provider = {
      accepts: () => true,
      candidates: () => ['#lain'],
      describe: () => undefined,
    };

    expect(viewAt('#l', 2, bare)?.rows).toStrictEqual([
      { word: '#lain', label: '#lain', description: '', words: ['#lain'] },
    ]);
  });

  it('completes to a row the way Tab does', () => {
    expect(viewAt('/ho', 3)?.pick('/host')).toStrictEqual({ text: '/host ', cursor: 6 });
  });
});

describe('a long list', () => {
  it('returns every row', () => {
    expect(viewAt('/c', 2, MANY)?.rows).toHaveLength(MANY_COUNT);
  });

  it('indexes the highlighted row into the full list past the eighth', () => {
    const { view } = tabbed('/c', MANY, -1);

    expect(view?.rows).toHaveLength(MANY_COUNT);
    expect(view?.active).toBe(MANY_COUNT - 1);
    expect(view?.rows[MANY_COUNT - 1]?.word).toBe('/c9');
  });
});

describe('a Tab completion in progress', () => {
  it('keeps the list of the word it started from and highlights the row in the line', () => {
    const { line, view } = tabbed('/ho', PROVIDER, 0);

    expect(line).toBe('/home ');
    expect(view?.rows.map((row) => row.word)).toStrictEqual(['/home', '/host']);
    expect(view?.active).toBe(0);
  });

  it('steps the highlight with the cycle', () => {
    const { line, view } = tabbed('/ho', PROVIDER, 1);

    expect(line).toBe('/host ');
    expect(view?.active).toBe(1);
  });

  it('highlights the row of an alias in the line', () => {
    const { line, view } = tabbed('/h', PROVIDER, 0);

    expect(line).toBe('/h ');
    expect(view?.active).toBe(0);
  });

  it('highlights no row while nothing is completed', () => {
    expect(viewAt('/ho', 3)?.active).toBe(-1);
  });
});
