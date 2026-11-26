/**
 * `/lang [code|name|auto]` (alias `/language`, decision 6, decision 19,
 * WFE-310): choose the language of WiredFE's own text. Bare, it prints the
 * language in use, where that came from (the reader's setting, the instance
 * default, the browser or the fallback) and every language as
 * `code — native name — English name`. A code (`de`, any case; `de-AT` is
 * `de`; `zh`, `zh-CN` and `zh-Hans` are `zh-Hans`), a native name
 * (`Deutsch`) or an English name (`German`) sets it; `auto` clears the
 * setting, back to the instance default and then the browser. The setting is
 * saved and synced like any other (decision 17). `--pick` opens the list of
 * languages, which is what the hotkeys run (`Ctrl+B Shift+l`, `Shift+l`).
 */

import { languageFor, languageLine } from '../../i18n/languageLabels';
import { parseLanguage } from '../../i18n/parseLanguage';
import { resolveSource } from '../../i18n/resolveLocale';
import { SUPPORTED_LOCALES } from '../../i18n/supportedLocales';
import { t } from '../../i18n/translate';
import { AUTO_WORD } from '../languageWords';
import { OK, fail, syncRun } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The flag that opens the list of languages instead of naming one. */
const PICK_FLAG = '--pick';

/** The language in use and the source that chose it, for the setting {@link language} and this browser. */
function resolved(language: string | null): ReturnType<typeof resolveSource> {
  return resolveSource({ user: language ?? undefined, browser: navigator.languages });
}

/** The values the `current` and `cleared` messages take for {@link language}'s resolution. */
function describing(language: string | null): Record<string, string> {
  const { locale, source } = resolved(language);
  return { name: languageFor(locale).native, code: locale, source };
}

/** Print the language in use, where it came from, and every language to choose from. */
function show(context: CommandContext): CommandOutcome {
  context.print(t('commands.defs.lang.current', describing(context.state.settings.language)));
  context.print(t('commands.defs.lang.available'));
  for (const language of SUPPORTED_LOCALES) {
    context.print(`  ${languageLine(language)}`);
  }
  return OK;
}

/** Open the list of languages in the start menu's place. */
function pick(context: CommandContext): CommandOutcome {
  context.dispatch({ type: 'startMenu', open: false });
  context.dispatch({ type: 'languageMenu', open: true });
  return OK;
}

/** Clear the setting, so the instance default and then the browser decide. */
function clear(context: CommandContext): CommandOutcome {
  context.dispatch({ type: 'settings', settings: { language: null } });
  context.print(t('commands.defs.lang.cleared', describing(null)));
  return OK;
}

/** Make the language {@link word} names the setting; refuse a word that names none. */
function choose(word: string, context: CommandContext): CommandOutcome {
  const code = parseLanguage(word);
  if (code === null) {
    const choices = SUPPORTED_LOCALES.map(languageLine).join('; ');
    return fail(t('commands.defs.lang.unknown', { input: word, choices }));
  }
  context.dispatch({ type: 'settings', settings: { language: code } });
  context.print(t('commands.defs.lang.set', describing(code)));
  return OK;
}

/** Show, choose or clear the language the argument text asks for. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const word = args.trim();
  if (word === '') {
    return show(context);
  }
  if (word === PICK_FLAG) {
    return pick(context);
  }
  return word.toLowerCase() === AUTO_WORD ? clear(context) : choose(word, context);
}

/** The `/lang` definition. */
export const command: CommandDefinition = {
  name: 'lang',
  aliases: ['language'],
  get usage(): string {
    return t('commands.defs.lang.usage');
  },
  get summary(): string {
    return t('commands.defs.lang.summary');
  },
  run: syncRun(handle),
  bindings: [
    ...tmuxBindings('Shift+l', PICK_FLAG),
    { mode: 'navigation', chord: 'Shift+l', args: PICK_FLAG },
  ],
};
