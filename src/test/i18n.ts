/**
 * The i18n test helper (decision 19): install an in-memory catalog for a fake
 * language and switch to it, so a test can prove a string follows the
 * language without any file in `src/i18n/locales`. The catalog is nested like
 * `en.json` and only needs the messages the test cares about; the rest falls
 * back to English. `setup.ts` puts English back after every test.
 */
import { activateCatalog, resetLocale } from '../i18n/activeLocale';
import type { Messages } from '../i18n/messages';

/** The language tag the fake catalog is installed under. */
export const FAKE_LOCALE = 'qps-ploc';

/** Make {@link messages} the catalog of {@link FAKE_LOCALE} and switch to it. */
export function installFakeLocale(messages: Messages): void {
  activateCatalog(FAKE_LOCALE, messages);
}

/** Back to English with every installed catalog dropped. */
export function resetFakeLocale(): void {
  resetLocale();
}
