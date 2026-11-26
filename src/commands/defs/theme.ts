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

import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import { type Theme, THEMES } from '../../state/settings';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The setting the command turns, as the line it prints back names it. */
const SETTING = 'theme';

/** The command's one form. */
function usage(): string {
  return t('commands.defs.theme.usage');
}

/** Whether {@link word} names a theme, narrowed to {@link Theme}. */
function isTheme(word: string): word is Theme {
  const names: readonly string[] = THEMES;
  return names.includes(word);
}

/** Print every theme, the one {@link context}'s settings choose tagged. */
function listThemes(context: CommandContext): void {
  context.print(t('commands.defs.theme.list_header'));
  const current = context.state.settings.theme;
  for (const theme of THEMES) {
    context.print(
      theme === current ? t('commands.defs.theme.current', { name: theme }) : `  ${theme}`,
    );
  }
}

/** Do what one argument text asks: list the themes, or choose the named one. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [name, extra] = wordsOf(args);
  if (extra !== undefined) {
    return fail(t('commands.defs.theme.usage_error', { usage: usage() }));
  }
  if (name === undefined) {
    listThemes(context);
    return OK;
  }
  if (!isTheme(name)) {
    return fail(t('commands.defs.theme.no_theme', { name }));
  }
  context.dispatch({ type: 'settings', settings: { theme: name } });
  context.print(`${SETTING} = ${name}`);
  return OK;
}

/** The `/theme` definition. */
export const command: CommandDefinition = {
  name: 'theme',
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.theme.summary');
  },
  run: syncRun(handle),
};
