/**
 * `t()` (decision 19): a message of the catalog formatted in the language in
 * use. The key is typed, so a key that is not in `en.json` fails `tsc`. When
 * the language's own message is missing, does not parse, or names other
 * arguments than the English one (a stale translation), the English message
 * is used. Never call it at module load: the language is not known yet.
 */

import type { IntlMessageFormat } from 'intl-messageformat';

import { activeLocale } from './activeLocale';
import { SOURCE_LOCALE, catalogFor } from './catalogs';
import { parseMessage, sameArguments } from './formatters';
import type { MessageKey, MessageValues } from './messages';

/** The usable formatter of {@link key} in {@link locale}, built once; null when there is none. */
function formatterFor(locale: string, key: string): IntlMessageFormat | null {
  const catalog = catalogFor(locale);
  if (catalog === undefined) {
    return null;
  }
  const cached = catalog.formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const message = catalog.messages.get(key);
  const parsed = message === undefined ? null : parseMessage(message, locale);
  const source = locale === SOURCE_LOCALE ? parsed : formatterFor(SOURCE_LOCALE, key);
  const usable = parsed !== null && source !== null && sameArguments(parsed, source);
  const formatter = usable ? parsed : null;
  catalog.formatters.set(key, formatter);
  return formatter;
}

/**
 * {@link key} formatted with {@link values} in {@link locale}, falling back to
 * English; the key itself when English has no such message.
 */
export function translate(locale: string, key: string, values?: MessageValues): string {
  const formatter = formatterFor(locale, key) ?? formatterFor(SOURCE_LOCALE, key);
  return formatter === null ? key : [formatter.format<string>(values)].flat().join('');
}

/** {@link key} formatted with {@link values} in the language in use. */
export function t(key: MessageKey, values?: MessageValues): string {
  return translate(activeLocale(), key, values);
}
