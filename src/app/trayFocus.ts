/**
 * Where the reader goes from `[+N media]` in the status line (WFE-287): the
 * first alt-text input of the tray above the command line, so a description
 * can be typed without hunting for it. The tray is found by its accessible
 * name, which the tray and this module share.
 */

import { t } from '../i18n/translate';

/** Focus the first alt-text input of the tray; nothing happens while no tray is on screen. */
export function showFirstDescription(): void {
  const name = t('app.pending_media').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const selector = `ul[aria-label="${name}"] input[type="text"]`;
  document.querySelector<HTMLInputElement>(selector)?.focus();
}
