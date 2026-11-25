/**
 * The entry types the status line lists: desktops, and windows with activity
 * that the active desktop does not show.
 */

/** One desktop in the status line's desktop list. */
export type StatusLineDesktop = {
  /** 1-based desktop number, what `/desktop N` uses. */
  readonly number: number;
  /** Unread items in the windows the desktop shows; 0 shows nothing extra. */
  readonly unread: number;
  /** True when a shown window has a mention or DM waiting. */
  readonly highlight: boolean;
  /** True for the desktop on screen. */
  readonly active: boolean;
};

/** One window with activity that the active desktop does not show. */
export type StatusLineWindow = {
  /** 1-based window number, what `/win N` uses. */
  readonly number: number;
  /** Short name, e.g. "home" or "dm/bob". */
  readonly title: string;
  /** Items waiting in the window; 0 shows nothing extra. */
  readonly unread: number;
  /** True when a mention or DM is waiting. */
  readonly highlight: boolean;
};
