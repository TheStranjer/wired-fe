/**
 * Keep the language in use equal to the reader's choice (decision 19,
 * WFE-310): whenever the `language` setting changes — `/lang`, a sync from
 * another device, the settings read at startup — the language to show is
 * worked out again from it, the build's default language (`defaultLocale`,
 * WFE-309) and the browser's language list, and the switch starts. Renders
 * nothing.
 */

import type { JSX } from 'react';
import { useEffect } from 'react';

import { buildConfig } from '../config/config';
import { setLocale } from '../i18n/activeLocale';
import { resolveLocale } from '../i18n/resolveLocale';
import { useAppState } from '../state/StateContext';

/** Switch to the language the setting and `navigator.languages` ask for, when it is supported. */
export function LocaleSetting(): JSX.Element | null {
  const { language } = useAppState().settings;
  useEffect(() => {
    void setLocale(
      resolveLocale({
        user: language ?? undefined,
        instance: buildConfig.defaultLocale,
        browser: navigator.languages,
      }),
    );
  }, [language]);
  return null;
}
