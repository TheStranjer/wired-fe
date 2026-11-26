/**
 * The React side of i18n (decision 19): a provider that follows the language
 * in use and keeps `<html lang>` equal to it, and {@link useT}, the `t()` a
 * component calls so it re-renders when the language changes. Plain code that
 * runs at event time (commands) calls `t()` from ./translate instead.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';

import { activeLocale, subscribeLocale } from './activeLocale';
import { SOURCE_LOCALE } from './catalogs';
import type { MessageKey, MessageValues } from './messages';
import { translate } from './translate';

/** The language the tree below shows; English where there is no provider. */
const LocaleContext = createContext<string>(SOURCE_LOCALE);

/** Show {@link children} in the language in use and put it on `<html lang>`. */
export function I18nProvider(props: { readonly children: ReactNode }): JSX.Element {
  const locale = useSyncExternalStore(subscribeLocale, activeLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext value={locale}>{props.children}</LocaleContext>;
}

/** The language the tree below shows, for a component that must re-render when it changes. */
export function useLocale(): string {
  return use(LocaleContext);
}

/** What `t()` is: a message key and its values in, the text in the language in use out. */
export type Translate = (key: MessageKey, values?: MessageValues) => string;

/** `t()` for components: a new function whenever the language changes. */
export function useT(): Translate {
  const locale = useLocale();
  return useCallback(
    (key: MessageKey, values?: MessageValues) => translate(locale, key, values),
    [locale],
  );
}
