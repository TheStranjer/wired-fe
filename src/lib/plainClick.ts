/**
 * Whether a click is the plain one (WFE-264): the primary button with no
 * modifier key. A link that the app opens itself keeps the browser's own
 * behaviour for every other click: a middle click, or one with Ctrl, Cmd,
 * Shift or Alt held, still opens the raw file in a new tab or window.
 */

/** True for a primary-button click with no Ctrl, Meta, Shift or Alt held; any mouse event fits. */
export function isPlainClick(
  click: Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return click.button === 0 && !click.ctrlKey && !click.metaKey && !click.shiftKey && !click.altKey;
}
