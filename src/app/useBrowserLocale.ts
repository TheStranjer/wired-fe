/**
 * Start in the reader's language (decision 19): once, on mount, pick the
 * supported language the build's default language (`defaultLocale`) or else
 * the browser's own language list names and switch to it. The reader's own
 * setting joins the choice in a later ticket.
 */

import { useEffect } from 'react';

import { buildConfig } from '../config/config';
import { setLocale } from '../i18n/activeLocale';
import { resolveLocale } from '../i18n/resolveLocale';

/** Switch to the build's default language, else the one `navigator.languages` asks for. */
export function useBrowserLocale(): void {
  useEffect(() => {
    void setLocale(
      resolveLocale({ instance: buildConfig.defaultLocale, browser: navigator.languages }),
    );
  }, []);
}
