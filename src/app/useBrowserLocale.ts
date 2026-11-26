/**
 * Start in the reader's language (decision 19): once, on mount, pick the
 * supported language the browser's own language list names and switch to it.
 * The instance default and the reader's own setting join the choice in later
 * tickets.
 */

import { useEffect } from 'react';

import { setLocale } from '../i18n/activeLocale';
import { resolveLocale } from '../i18n/resolveLocale';

/** Switch to the language `navigator.languages` asks for, when it is supported. */
export function useBrowserLocale(): void {
  useEffect(() => {
    void setLocale(resolveLocale({ browser: navigator.languages }));
  }, []);
}
