/**
 * Tab completion of command names (decision 6): the line's first word
 * starting with `/` completes to every command name and alias of the
 * registry, and describes each one for the suggestion list (WFE-297) from the
 * same registry entry, so the list and the completion never disagree. A row is
 * described when it is asked for, never kept: a summary is translated text
 * (decision 19) and must follow the language as it changes. A row also carries
 * the command's detail block (./commandDetail, WFE-311).
 */

import type { Keymap } from './bindingTypes';
import { commandDetail } from './commandDetail';
import type { Described, Provider } from './complete';
import type { CommandDefinition, Registry } from './types';
import { compareWords } from '../lib/words';

/** What a command word is written with in front of its name. */
const COMMAND_PREFIX = '/';

/**
 * The row of {@link definition}: its name with its aliases beside it, its
 * one-line summary as it reads now, and its detail (usage, aliases and the
 * keys of {@link keymap}, WFE-311).
 */
function noteOf(definition: CommandDefinition, keymap: Keymap): Described {
  const also = (definition.aliases ?? []).map((alias) => `${COMMAND_PREFIX}${alias}`).join(', ');
  const label = `${COMMAND_PREFIX}${definition.name}`;
  return {
    word: label,
    label: also === '' ? label : `${label} (${also})`,
    description: definition.summary,
    detail: commandDetail(definition, keymap),
  };
}

/** Every name and alias of {@link registry}, each written as it is completed, with the command it belongs to. */
function commandsByWord(registry: Registry): Map<string, CommandDefinition> {
  const byWord = new Map<string, CommandDefinition>();
  for (const definition of registry.commands) {
    for (const name of [definition.name, ...(definition.aliases ?? [])]) {
      byWord.set(`${COMMAND_PREFIX}${name}`, definition);
    }
  }
  return byWord;
}

/**
 * The provider for commands: the line's first word starting with `/` completes
 * to `/name` for every name and alias that starts with it, because the
 * registry is the one source of both (decision 6). Registry names are already
 * lowercase, so only the typed word is lowercased before matching, the way
 * parseInput does; a bare `/` offers every command. {@link keymap} is the
 * effective one, so a row's detail lists the keys as the reader has them.
 */
export function commandProvider(registry: Registry, keymap: Keymap): Provider {
  const byWord = commandsByWord(registry);
  const words = [...byWord.keys()];

  return {
    accepts: (word, isFirstWord) => isFirstWord && word.startsWith(COMMAND_PREFIX),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return words.filter((candidate) => candidate.startsWith(prefix)).toSorted(compareWords);
    },
    describe: (candidate) => {
      const definition = byWord.get(candidate);
      return definition === undefined ? undefined : noteOf(definition, keymap);
    },
  };
}
