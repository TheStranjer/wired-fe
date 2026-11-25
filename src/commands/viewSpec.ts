/**
 * View specs (decisions 12 and 13): the small grammar `/vsplit` and `/split`
 * read after their name to say which view the new pane shows — `home`, `tag
 * rust`, `win 3`. Pure: the text becomes a {@link ViewSpec} naming either an
 * existing window by number or the open command that makes the window (`dm`
 * is `/query`), so the pane-header menus, `/float` and the placement commands
 * can read the same words. Running the command, which resolves handles and
 * labels against the app state, is ./splitRun's.
 */

import { type Result, err, ok } from '../lib/result';
import { wordsOf } from '../lib/words';

/** A view spec read: an existing window by its 1-based number, or a command that opens one. */
export type ViewSpec =
  | { readonly type: 'window'; readonly number: number }
  | { readonly type: 'open'; readonly command: string; readonly args: string };

/** Whether a view takes no argument, may take one, or has to. */
type Arity = 'none' | 'optional' | 'required';

/** One view word: the command that opens it and what it wants after it. */
type View = { readonly command: string; readonly arity: Arity };

/** The view words, each with the command that opens its window. */
const VIEWS: ReadonlyMap<string, View> = new Map<string, View>([
  ['home', { command: 'home', arity: 'none' }],
  ['local', { command: 'local', arity: 'none' }],
  ['federated', { command: 'federated', arity: 'none' }],
  ['notifications', { command: 'notifications', arity: 'none' }],
  ['composer', { command: 'composer', arity: 'none' }],
  ['tag', { command: 'tag', arity: 'required' }],
  ['search', { command: 'search', arity: 'required' }],
  ['dm', { command: 'query', arity: 'required' }],
  ['whois', { command: 'whois', arity: 'optional' }],
  ['profile', { command: 'whois', arity: 'optional' }],
  ['thread', { command: 'thread', arity: 'optional' }],
]);

/** The view word for an existing window, which takes its number. */
const WINDOW_WORD = 'win';

/** Every view word, in the order they are listed and completed. */
export const VIEW_WORDS: readonly string[] = [...VIEWS.keys(), WINDOW_WORD];

/** A window number: digits, one or more. */
const NUMBER = /^[1-9]\d*$/u;

/** Reads `win <N>`: the window number, or why it is not one. */
function windowSpec(rest: string): Result<ViewSpec, string> {
  return NUMBER.test(rest)
    ? ok({ type: 'window', number: Number(rest) })
    : err('win takes a window number');
}

/** Reads a spec of {@link view} whose command word was {@link word}; {@link rest} is what follows it. */
function openSpec(word: string, view: View, rest: string): Result<ViewSpec, string> {
  if (view.arity === 'none' && rest !== '') {
    return err(`${word} takes no argument`);
  }
  if (view.arity === 'required' && rest === '') {
    return err(`${word} needs an argument`);
  }
  return ok({ type: 'open', command: view.command, args: rest });
}

/**
 * Reads view spec text: its first word names the view, the rest is that
 * view's argument. The error says what was wrong; the caller adds the usage.
 */
export function parseViewSpec(text: string): Result<ViewSpec, string> {
  const [first = ''] = wordsOf(text);
  const word = first.toLowerCase();
  const rest = text.trim().slice(first.length).trim();
  if (word === WINDOW_WORD) {
    return windowSpec(rest);
  }
  const view = VIEWS.get(word);
  return view === undefined ? err(`Unknown view: ${first}`) : openSpec(word, view, rest);
}
