/**
 * Where the reader goes from `[+N media]` in the status line (WFE-287): the
 * first alt-text input of the tray above the command line, so a description
 * can be typed without hunting for it. The tray is found by its accessible
 * name, which the tray and this module share.
 */

/** The accessible name of the tray's list of pending media. */
export const PENDING_MEDIA_LABEL = 'Pending media';

/** Focus the first alt-text input of the tray; nothing happens while no tray is on screen. */
export function showFirstDescription(): void {
  const selector = `ul[aria-label="${PENDING_MEDIA_LABEL}"] input[type="text"]`;
  document.querySelector<HTMLInputElement>(selector)?.focus();
}
