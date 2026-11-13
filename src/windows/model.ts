/**
 * The window model: what a window is, how it is named and how it is found
 * again (AGENTS.md "Windows, like IRC buffers"). Pure data and lookups;
 * transitions between states live in the reducer next door.
 */

/** The kinds of view a window can hold. */
export type WindowKind =
  | 'status'
  | 'home'
  | 'local'
  | 'federated'
  | 'notifications'
  | 'thread'
  | 'hashtag'
  | 'profile'
  | 'dm'
  | 'search';

/** What a window shows. */
export type WindowRef = {
  readonly kind: WindowKind;
  /** Owning account key; `null` only for the status window. */
  readonly accountKey: string | null;
  /** Status id, tag, account id or query; `null` when the kind needs none. */
  readonly target: string | null;
};

/** One numbered window, as the status line and the window commands see it. */
export type WindowState = {
  readonly id: string;
  readonly ref: WindowRef;
  readonly title: string;
  readonly unread: number;
  readonly highlight: boolean;
};

/** The layer's whole state: windows in display order, plus the active one. */
export type WindowsState = {
  readonly windows: readonly WindowState[];
  readonly activeId: string;
};

/** The id of window 1, the client-message buffer every session starts with. */
export const STATUS_WINDOW_ID = 'status';

/** Window 1: unread nothing, never highlighted, owned by no account. */
const STATUS_WINDOW: WindowState = {
  id: STATUS_WINDOW_ID,
  ref: { kind: 'status', accountKey: null, target: null },
  title: STATUS_WINDOW_ID,
  unread: 0,
  highlight: false,
};

/**
 * The id of the view a ref names, so opening the same view twice finds the
 * window that already shows it. The status window is `status`; any other view
 * is `kind:account:target`, with `-` standing in for an absent part.
 */
export function windowId(ref: WindowRef): string {
  if (ref.kind === 'status') {
    return STATUS_WINDOW_ID;
  }
  return `${ref.kind}:${ref.accountKey ?? '-'}:${ref.target ?? '-'}`;
}

/** The window list before anything has been opened: window 1, active. */
export function initialWindowsState(): WindowsState {
  return { windows: [STATUS_WINDOW], activeId: STATUS_WINDOW_ID };
}

/** The 1-based number a window is listed with, or `null` for an unknown id. */
export function windowNumber(state: WindowsState, id: string): number | null {
  const index = state.windows.findIndex((win) => win.id === id);
  if (index === -1) {
    return null;
  }
  return index + 1;
}

/**
 * The window commands, hotkeys and features act on. An `activeId` that names
 * no window should never happen; rather than throw, it falls back to window 1,
 * which is always the status window.
 */
export function activeWindow(state: WindowsState): WindowState {
  const active = state.windows.find((win) => win.id === state.activeId);
  if (active !== undefined) {
    return active;
  }
  const [first] = state.windows;
  return first ?? STATUS_WINDOW;
}
