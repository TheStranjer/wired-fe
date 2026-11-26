/**
 * The accessible names of the status line's desktop and window entries, each
 * one whole translated sentence: the state words ("active", "3 unread",
 * "highlighted") live inside the message as ICU branches, so a language can
 * order them as it likes. Pure; the caller hands in its `t()`.
 */
import type { StatusLineDesktop, StatusLineWindow } from './statusLineTypes';
import type { Translate } from '../i18n/messages';

/** The accessible name of one desktop, e.g. "Desktop 2, active, 12 unread". */
export function desktopLabel(t: Translate, entry: StatusLineDesktop): string {
  return t('ui.status_line.desktop', {
    active: String(entry.active),
    highlight: String(entry.highlight),
    number: entry.number,
    unread: entry.unread,
  });
}

/** The accessible name of one window entry, e.g. "Window 7: dm/bob, 2 unread". */
export function windowLabel(t: Translate, entry: StatusLineWindow): string {
  return t('ui.status_line.window', {
    highlight: String(entry.highlight),
    number: entry.number,
    title: entry.title,
    unread: entry.unread,
  });
}
