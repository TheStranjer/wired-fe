/**
 * Painting the reader's chosen theme and effects on the document (WFE-131,
 * WFE-132, AGENTS.md "Monospace grid, theme tokens, optional effects"):
 * src/theme/tokens.css carries the default `wired` colors on the bare `:root`
 * and the other themes under `:root[data-theme='...']`, and
 * src/theme/effects.css paints the CRT overlay only under
 * `:root[data-effects='on']`, so the shell re-skins the moment the root
 * element names the theme and the effects follow the `effects` setting. This
 * hook only mirrors those two settings onto `documentElement` — storage and
 * state are the settings record's own paths (src/state,
 * ./useSettingsPersistence). `wired` needs no theme attribute and effects-off
 * needs no effects attribute, so each removes what a previous choice left.
 */

import { useEffect } from 'react';

import type { Theme } from '../state/settings';

/** Put {@link theme} on the document root: its name as `data-theme`, or none. */
export function useTheme(theme: Theme, effects: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'wired') {
      delete root.dataset['theme'];
    } else {
      root.dataset['theme'] = theme;
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (effects) {
      root.dataset['effects'] = 'on';
    } else {
      delete root.dataset['effects'];
    }
  }, [effects]);
}
