/**
 * `/set [key [value]]` (decision 6, alias `/settings`): the reader's own knobs,
 * listed and turned from the command line, off the SETTING_KEYS metadata of
 * src/state/settings. No argument prints one `  key = value  — description`
 * line per setting; a key prints just its line; a key and a value turn the
 * knob — an enum must name one of its words, a boolean takes on/off/true/
 * false/yes/no and prints as on/off — dispatching the `settings` action and
 * printing `<key> = <value>` back; ./useSettingsPersistence stores the new
 * record. An unknown key answers `No setting <key>. Try /set`, a refused word
 * lists the words the knob takes, and a third word echoes the usage. The
 * `local` audience of `defaultVisibility` needs `localOnlyPosts` on the active
 * account's instance (WFE-172) and is not listed without it.
 */

import { requireFeature } from '../../capabilities/requireFeature';
import { availableVisibilities } from '../../capabilities/visibilities';
import { capabilitiesFor } from '../../state/selectors';
import {
  CLOCK_FORMATS,
  DENSITIES,
  SETTING_KEYS,
  type SettingKey,
  type Settings,
  THEMES,
  VISIBILITIES,
} from '../../state/settings';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/set [key [value]]';

/** The words a boolean knob takes and the value each means. */
const MEANINGS: ReadonlyMap<string, boolean> = new Map([
  ['on', true],
  ['true', true],
  ['yes', true],
  ['off', false],
  ['false', false],
  ['no', false],
]);

/** One knob turned: the patch for the reducer and the word that prints. */
type Turn = { readonly patch: Partial<Settings>; readonly word: string };

/** Whether {@link raw} is one of {@link values}, narrowed to their type. */
function isOneOf<T extends string>(values: readonly T[], raw: string): raw is T {
  const words: readonly string[] = values;
  return words.includes(raw);
}

/** How a value reads: booleans say on and off, the rest speak for themselves. */
function shown(value: string | boolean): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }
  return value;
}

/** The listed line of {@link meta}, taken from {@link context}'s state. */
function listed(context: CommandContext, meta: SettingKey): string {
  return `  ${meta.key} = ${shown(context.state.settings[meta.key])}  — ${meta.description}`;
}

/** The listed keys whose value is a word, and the ones whose value is a switch. */
type BooleanKey = 'avatars' | 'effects' | 'expandMedia' | 'images';

/** The listed keys whose value is one of a few words. */
type EnumKey = 'clockFormat' | 'defaultVisibility' | 'density' | 'theme';

/** The patch turning the boolean knob {@link key} to {@link value}. */
function booleanPatch(key: BooleanKey, value: boolean): Partial<Settings> {
  switch (key) {
    case 'avatars':
      return { avatars: value };
    case 'effects':
      return { effects: value };
    case 'expandMedia':
      return { expandMedia: value };
    case 'images':
      return { images: value };
  }
}

/** Turn a boolean knob: the word's meaning becomes the patch, printed as on or off. */
function booleanTurn(key: BooleanKey, raw: string): Turn | null {
  const value = MEANINGS.get(raw);
  if (value === undefined) {
    return null;
  }
  return { patch: booleanPatch(key, value), word: shown(value) };
}

/** Turn an enum knob: the word, if the knob lists it, becomes the patch and prints as itself. */
function enumTurn(key: EnumKey, raw: string): Turn | null {
  switch (key) {
    case 'clockFormat':
      return isOneOf(CLOCK_FORMATS, raw) ? { patch: { clockFormat: raw }, word: raw } : null;
    case 'defaultVisibility':
      return isOneOf(VISIBILITIES, raw) ? { patch: { defaultVisibility: raw }, word: raw } : null;
    case 'density':
      return isOneOf(DENSITIES, raw) ? { patch: { density: raw }, word: raw } : null;
    case 'theme':
      return isOneOf(THEMES, raw) ? { patch: { theme: raw }, word: raw } : null;
  }
}

/** Turn {@link meta} to {@link raw}: the patch and print word, or null to refuse. */
function turnOf(meta: SettingKey, raw: string): Turn | null {
  switch (meta.key) {
    case 'clockFormat':
    case 'defaultVisibility':
    case 'density':
    case 'theme':
      return enumTurn(meta.key, raw);
    case 'avatars':
    case 'effects':
    case 'expandMedia':
    case 'images':
      return booleanTurn(meta.key, raw);
  }
}

/** The words {@link meta} takes for the active account's backend: `local` only where it exists. */
function wordsFor(context: CommandContext, meta: SettingKey): readonly string[] | undefined {
  if (meta.key !== 'defaultVisibility') {
    return meta.values;
  }
  return availableVisibilities(capabilitiesFor(context.state, context.state.activeAccountKey));
}

/** Turn one knob: dispatch the patch and print the word, or refuse the value. */
function setOne(context: CommandContext, meta: SettingKey, raw: string): CommandOutcome {
  if (meta.key === 'defaultVisibility' && raw === 'local') {
    const local = requireFeature(context, context.state.activeAccountKey, 'localOnlyPosts');
    if (!local.ok) {
      return fail(local.error);
    }
  }
  const turned = turnOf(meta, raw);
  if (turned === null) {
    const words = wordsFor(context, meta);
    const list = words === undefined ? 'on|off|true|false|yes|no' : words.join('|');
    return fail(`${meta.key} takes ${list}`);
  }
  context.dispatch({ type: 'settings', settings: turned.patch });
  context.print(`${meta.key} = ${turned.word}`);
  return OK;
}

/** Do what one argument text asks: list every setting, show one, or turn one. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [key = '', value, extra] = args.trim().split(/\s+/u);
  if (key === '') {
    for (const meta of SETTING_KEYS) {
      context.print(listed(context, meta));
    }
    return OK;
  }
  const meta = SETTING_KEYS.find((entry) => entry.key === key);
  if (meta === undefined) {
    return fail(`No setting ${key}. Try /set`);
  }
  if (value === undefined) {
    context.print(listed(context, meta));
    return OK;
  }
  if (extra !== undefined) {
    return fail(`Usage: ${USAGE}`);
  }
  return setOne(context, meta, value);
}

/** The `/set` (alias `/settings`) definition. */
export const command: CommandDefinition = {
  name: 'set',
  aliases: ['settings'],
  usage: USAGE,
  summary: 'Show or change your settings',
  run: syncRun(handle),
};
