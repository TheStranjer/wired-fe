/**
 * Tab completion of command names (decision 6): the line's first word
 * starting with `/` completes to every command name and alias of the
 * registry, and describes each one for the suggestion list (WFE-297) from the
 * same registry entry, so the list and the completion never disagree.
 */

import type { Described, Provider } from './complete';
import type { Registry } from './types';
import { compareWords } from '../lib/words';

/** What a command word is written with in front of its name. */
const COMMAND_PREFIX = '/';

/** The row of a command: its name with its aliases beside it, and its one-line summary. */
function noteOf(name: string, aliases: readonly string[], summary: string): Described {
  const also = aliases.map((alias) => `${COMMAND_PREFIX}${alias}`).join(', ');
  const label = `${COMMAND_PREFIX}${name}`;
  return {
    word: label,
    label: aliases.length === 0 ? label : `${label} (${also})`,
    description: summary,
  };
}

/** Every name and alias of {@link registry}, each written as it is completed, with the row it belongs to. */
function commandNotes(registry: Registry): Map<string, Described> {
  const notes = new Map<string, Described>();
  for (const definition of registry.commands) {
    const aliases = definition.aliases ?? [];
    const note = noteOf(definition.name, aliases, definition.summary);
    for (const name of [definition.name, ...aliases]) {
      notes.set(`${COMMAND_PREFIX}${name}`, note);
    }
  }
  return notes;
}

/**
 * The provider for commands: the line's first word starting with `/` completes
 * to `/name` for every name and alias that starts with it, because the
 * registry is the one source of both (decision 6). Registry names are already
 * lowercase, so only the typed word is lowercased before matching, the way
 * parseInput does; a bare `/` offers every command.
 */
export function commandProvider(registry: Registry): Provider {
  const notes = commandNotes(registry);
  const words = [...notes.keys()];

  return {
    accepts: (word, isFirstWord) => isFirstWord && word.startsWith(COMMAND_PREFIX),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return words.filter((candidate) => candidate.startsWith(prefix)).toSorted(compareWords);
    },
    describe: (candidate) => notes.get(candidate),
  };
}
