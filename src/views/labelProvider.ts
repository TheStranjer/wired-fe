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
import { plainText } from './quoteView';
import type { Status } from '../api/schemas/status';
import { wordsOf } from '../lib/words';
import type { AppState } from '../state/appState';
import { shownQuote } from '../state/bufferPosts';
import { labelForStatus, statusOfLine } from '../state/bufferSelection';
import { activeBuffer } from '../state/selectors';

/** The most labels one word may offer. */
const MAX_LABELS = 50;

/** The most characters of a post's words a description shows; `…` marks a cut. */
const WORDS_LIMIT = 40;

/** What marks a label typed in brackets. */
const BRACKET = '[';

/** A bracketed label word while it is typed: `[`, `[a`, `[a3`, `[a3]`. */
const BRACKET_WORD = /^\[[a-z]*[0-9]?\]?$/iu;

/** A label word while it is typed in an argument: letters, then at most a digit. */
const LABEL_WORD = /^[a-z]*[0-9]?$/iu;

/** The command a line starts with, lowercased and without its slash. */
const COMMAND_OF = /^\s*\/([a-z][a-z0-9-]*)(?=\s)/iu;

/** One labelled post of the scrollback. */
type Labelled = {
  readonly label: string;
  readonly status: Status;
};

/** Whether {@link line} starts with a command of {@link commands}. */
function takesPost(line: string, commands: ReadonlySet<string>): boolean {
  const name = COMMAND_OF.exec(line)?.[1];
  return name !== undefined && commands.has(name.toLowerCase());
}

/**
 * The labelled posts of the active window, newest line first: for each line
 * that still carries a status, the status and the quote it shows, once per
 * label.
 */
function labelled(state: AppState): readonly Labelled[] {
  const buffer = activeBuffer(state);
  const found = new Map<string, Labelled>();
  for (const line of buffer.lines.toReversed()) {
    const status = statusOfLine(line);
    for (const shown of status === null ? [] : shownOn(status)) {
      const label = labelForStatus(buffer, shown.id);
      if (label !== null && !found.has(label)) {
        found.set(label, { label, status: shown });
      }
    }
  }
  return [...found.values()];
}

/** The statuses a line of {@link status} can be named by: itself, then the quote under it. */
function shownOn(status: Status): readonly Status[] {
  const quote = shownQuote(status);
  return quote === null ? [status] : [status, quote];
}

/** {@link text} on one line, cut to {@link WORDS_LIMIT} characters with `…`. */
function clipped(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > WORDS_LIMIT ? `${flat.slice(0, WORDS_LIMIT)}…` : flat;
}

/** What a post says: its content warning in place of the body, else the body as plain text. */
function saying(status: Status): string {
  return status.spoiler_text === '' ? plainText(status.content) : `CW: ${status.spoiler_text}`;
}

/** The row of a labelled post: `<@author> words`, with `⟲` in front for a boost. */
function noteOf(word: string, status: Status): CompletionNote {
  const original = status.reblog ?? status;
  const marker = status.reblog === null ? '' : '⟲ ';
  const said = clipped(saying(original));
  const who = `<@${original.account.acct}>`;
  return { word, label: word, description: `${marker}${who} ${said}`.trim() };
}

/** The label word {@link word} is the start of: no bracket, no closing one, lowercase. */
function prefixOf(word: string): string {
  return word.replace(/^\[/u, '').replace(/\]$/u, '').toLowerCase();
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
