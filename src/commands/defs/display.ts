/**
 * `/display [key [value] | reset [key]]` (decision 15): the active window's
 * own say over the reader's `density`, `avatars` and `images` settings. No
 * argument prints the three effective values, each tagged `inherited` or
 * `overridden`; a key alone prints its line; a key and a value overrides it
 * for this window only (`/display density lines`, `/display avatars off`);
 * `reset` clears every override of the window and `reset <key>` clears one,
 * back to the setting. A word that names no key, a value the key does not
 * take, or a stray extra word is refused with what would have passed, and
 * nothing changes. Completion of keys and values is displayProvider's.
 */

import { wordsOf } from '../../lib/words';
import { resolveDisplay } from '../../state/resolveDisplay';
import type { DisplayChange } from '../../windows/display';
import { activeWindow } from '../../windows/model';
import { BOOLEAN_MEANINGS, BOOLEAN_WORDS, shown } from '../booleanWords';
import {
  DISPLAY_KEYS,
  type DisplayKey,
  RESET_WORD,
  isDensity,
  isDisplayKey,
  valuesOf,
} from '../displayWords';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/display [key [value] | reset [key]]';

/** The change that clears each key, back to the reader's setting. */
const CLEARS: Readonly<Record<DisplayKey, DisplayChange>> = {
  density: { density: undefined },
  avatars: { avatars: undefined },
  images: { images: undefined },
};

/** One override asked for: the change for the reducer and the word that prints. */
type Turn = { readonly change: DisplayChange; readonly word: string };

/** The turn setting {@link key} to the word {@link raw}, or null when the key refuses it. */
function turnOf(key: DisplayKey, raw: string): Turn | null {
  if (key === 'density') {
    return isDensity(raw) ? { change: { density: raw }, word: raw } : null;
  }
  const value = BOOLEAN_MEANINGS.get(raw);
  if (value === undefined) {
    return null;
  }
  const change = key === 'avatars' ? { avatars: value } : { images: value };
  return { change, word: shown(value) };
}

/** One line: {@link key}, its effective value and where the value comes from. */
function lineOf(context: CommandContext, key: DisplayKey): string {
  const { display } = activeWindow(context.windows);
  const value = resolveDisplay(context.state.settings, display)[key];
  const source = display[key] === undefined ? 'inherited' : 'overridden';
  return `  ${key} = ${shown(value)}  (${source})`;
}

/** Ask the window layer to apply {@link overrides} to the active window. */
function apply(context: CommandContext, overrides: DisplayChange): void {
  context.dispatchWindows({ type: 'setDisplay', id: activeWindow(context.windows).id, overrides });
}

/** Override {@link key} for the active window with the word {@link raw}. */
function setOne(context: CommandContext, key: DisplayKey, raw: string): CommandOutcome {
  const turn = turnOf(key, raw);
  if (turn === null) {
    const list = key === 'density' ? valuesOf(key).join('|') : BOOLEAN_WORDS;
    return fail(`${key} takes ${list}`);
  }
  apply(context, turn.change);
  context.print(`${key} = ${turn.word}`);
  return OK;
}

/** Clear one override, or all of them when {@link key} is absent. */
function reset(context: CommandContext, key: string | undefined): CommandOutcome {
  if (key === undefined) {
    apply(context, { density: undefined, avatars: undefined, images: undefined });
    context.print('Display overrides cleared');
    return OK;
  }
  if (!isDisplayKey(key)) {
    return fail(`No display key ${key}. Try /display`);
  }
  apply(context, CLEARS[key]);
  context.print(`${key} inherited`);
  return OK;
}

/** Do what one argument text asks: show, override or reset. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [first, second, third] = wordsOf(args);
  if (third !== undefined) {
    return fail(`Usage: ${USAGE}`);
  }
  if (first === undefined) {
    for (const key of DISPLAY_KEYS) {
      context.print(lineOf(context, key));
    }
    return OK;
  }
  if (first === RESET_WORD) {
    return reset(context, second);
  }
  if (!isDisplayKey(first)) {
    return fail(`No display key ${first}. Try /display`);
  }
  if (second === undefined) {
    context.print(lineOf(context, first));
    return OK;
  }
  return setOne(context, first, second);
}

/** The `/display` definition. */
export const command: CommandDefinition = {
  name: 'display',
  usage: USAGE,
  summary: "Show or override this window's density, avatars and images",
  run: syncRun(handle),
};
