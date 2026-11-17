/**
 * `/theme [name]` (decision 6, WFE-131): the color themes src/theme/tokens.css
 * paints, listed and chosen from the command line. No argument prints a
 * `Themes:` header and one `  <name>` line per theme, the current one tagged
 * `(current)`; a name dispatches the `settings` patch — ./useTheme repaints
 * the shell, ./useSettingsPersistence stores the choice — and prints
 * `theme = <name>` back. `/set theme <name>` turns the same knob; a word that
 * names no theme is refused with the names that would pass, and a second word
 * echoes the usage.
 */

import { wordsOf } from '../../lib/words';
import { type Theme, THEMES } from '../../state/settings';
import { fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form. */
const USAGE = '/theme [name]';

/** A run that showed or set what was asked; there is nothing else to report. */
const OK: CommandOutcome = { ok: true };

/** Whether {@link word} names a theme, narrowed to {@link Theme}. */
function isTheme(word: string): word is Theme {
  const names: readonly string[] = THEMES;
  return names.includes(word);
}

/** Print every theme, the one {@link context}'s settings choose tagged. */
function listThemes(context: CommandContext): void {
  context.print('Themes:');
  const current = context.state.settings.theme;
  for (const theme of THEMES) {
    const tag = theme === current ? ' (current)' : '';
    context.print(`  ${theme}${tag}`);
  }
}

/** Do what one argument text asks: list the themes, or choose the named one. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [name, extra] = wordsOf(args);
  if (extra !== undefined) {
    return fail(`Usage: ${USAGE}`);
  }
  if (name === undefined) {
    listThemes(context);
    return OK;
  }
  if (!isTheme(name)) {
    return fail(`No theme ${name}. Try /theme`);
  }
  context.dispatch({ type: 'settings', settings: { theme: name } });
  context.print(`theme = ${name}`);
  return OK;
}

/** The `/theme` definition. */
export const command: CommandDefinition = {
  name: 'theme',
  aliases: [],
  usage: USAGE,
  summary: 'List or choose the color theme',
  run: syncRun(handle),
};
