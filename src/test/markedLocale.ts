/**
 * A fake language that marks every command message (decision 19): each message
 * of `commands.defs` in `en.json` gets `§ ` in front, so a test can tell a
 * string that came through `t()` from a literal at a call site. `setup.ts`
 * puts English back after every test.
 */
import { installFakeLocale } from './i18n';
import english from '../i18n/locales/en.json';
import type { Messages } from '../i18n/messages';

/** What the language puts in front of every message. */
const MARK = '§ ';

/** {@link node} with {@link MARK} in front of every message. */
function marked(node: Messages): Messages {
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      typeof value === 'string' ? `${MARK}${value}` : marked(value),
    ]),
  );
}

/** Switch to the language that marks the command messages. */
export function markCommandMessages(): void {
  installFakeLocale({ commands: { defs: marked(english.commands.defs) } });
}
