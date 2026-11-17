/**
 * Painting the reader's chosen theme on the document (WFE-131, AGENTS.md
 * "Monospace grid, theme tokens"): src/theme/tokens.css carries the default
 * `wired` colors on the bare `:root` and the other themes under
 * `:root[data-theme='...']`, so the whole shell re-skins the moment the root
 * element names the theme. This hook only mirrors the `theme` setting onto
 * `documentElement` — storage and state are the settings record's own paths
 * (src/state, ./useSettingsPersistence). `wired` needs no attribute, so it
 * removes the one a previous theme left behind.
 */

import { useEffect } from 'react';

import type { Theme } from '../state/settings';

/** Put {@link theme} on the document root: its name as `data-theme`, or none. */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'wired') {
      delete root.dataset['theme'];
    } else {
      root.dataset['theme'] = theme;
    }
  }, [theme]);
}
