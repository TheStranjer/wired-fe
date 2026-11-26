/**
 * Tab completion of post labels (WFE-301, decision 6, AGENTS.md "Every post
 * has a short label"): the first argument of a command that takes a post
 * completes to the bare label (`a3`), and a word typed with `[` anywhere on
 * the line to the bracketed one (`[a3]`). The candidates are the labels of
 * the active window's lines that are still in its scrollback, newest first,
 * and each is described as `<@author> first words`: plain text, a content
 * warning in place of the body, a `⟲` in front of a boost, whose author is
 * the original's. Which commands take a post is the app's to say (the
 * layering gives views no path to commands), so it passes their words in.
 */

import type { CompletionNote } from './completionKit';
import type { CompletionProvider } from './completionProviders';
import { BRACKET_WORD, type Labelled, labelledIn, postWords, prefixOf } from './postLabels';
import type { Status } from '../api/schemas/status';
import { wordsOf } from '../lib/words';
import type { AppState } from '../state/appState';
import { activeBuffer } from '../state/selectors';

/** The most labels one word may offer. */
const MAX_LABELS = 50;

/** What marks a label typed in brackets. */
const BRACKET = '[';

/** A label word while it is typed in an argument: letters, then at most a digit. */
const LABEL_WORD = /^[a-z]*[0-9]?$/iu;

/** The command a line starts with, lowercased and without its slash. */
const COMMAND_OF = /^\s*\/([a-z][a-z0-9-]*)(?=\s)/iu;

/** Whether {@link line} starts with a command of {@link commands}. */
function takesPost(line: string, commands: ReadonlySet<string>): boolean {
  const name = COMMAND_OF.exec(line)?.[1];
  return name !== undefined && commands.has(name.toLowerCase());
}

/** The labelled posts of the active window, newest line first. */
function labelled(state: AppState): readonly Labelled[] {
  return labelledIn(activeBuffer(state));
}

/** The row of a labelled post: `<@author> words`, with `⟲` in front for a boost. */
function noteOf(word: string, status: Status): CompletionNote {
  return { word, label: word, description: postWords(status) };
}

/** {@link label} as it is completed: bracketed when the word was typed with a bracket. */
function written(label: string, bracketed: boolean): string {
  return bracketed ? `[${label}]` : label;
}

/**
 * The provider for post labels: a word starting with `[` anywhere, and the
 * first argument of a command in {@link commands} (also while it is still
 * empty), completes to the labels of the active window of {@link state}.
 */
export function labelProvider(state: AppState, commands: ReadonlySet<string>): CompletionProvider {
  return {
    bare: true,
    accepts: (word, isFirstWord, line = '') =>
      BRACKET_WORD.test(word) ||
      (!isFirstWord && LABEL_WORD.test(word) && takesPost(line, commands)),
    candidates: (word, before = '') => {
      const bracketed = word.startsWith(BRACKET);
      if (!bracketed && (wordsOf(before).length !== 1 || !takesPost(before, commands))) {
        return [];
      }
      const prefix = prefixOf(word);
      return labelled(state)
        .filter((entry) => entry.label.startsWith(prefix))
        .slice(0, MAX_LABELS)
        .map((entry) => written(entry.label, bracketed));
    },
    describe: (candidate) => {
      const label = prefixOf(candidate);
      const found = labelled(state).find((entry) => entry.label === label);
      return found === undefined ? undefined : noteOf(candidate, found.status);
    },
  };
}
