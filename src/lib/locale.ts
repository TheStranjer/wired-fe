/**
 * The language a visitor's mail should come in, from the browser's own
 * setting: the language subtag of a BCP 47 tag (`en` of `en-US`), `en` when
 * the browser names none. Pure.
 */

/** The language subtag of {@link language}, e.g. `de` for `de-AT`; `en` for an empty tag. */
export function localeOf(language: string): string {
  const [tag = ''] = language.split('-');
  return tag === '' ? 'en' : tag.toLowerCase();
}
