/**
 * Opening a post's attachment in a media window (decision 13, WFE-263): the
 * window kind `media`, whose ref is `{ kind: 'media', accountKey: <the post's
 * account>, target: '<statusId>:<n>' }` with `n` the 1-based attachment index.
 * Built here in the pure state layer so `/media` and the window's own previous
 * and next buttons share it. Opening the same status and index twice finds
 * the window that already shows it (src/windows/reducer); stepping to a
 * sibling opens that window and closes the one stepped from.
 */

import type { WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The open variant of the window list's vocabulary, which this builds. */
type OpenAction = Extract<WindowsAction, { readonly type: 'open' }>;

/** A media window's target, read: the post and the 1-based attachment index. */
export type MediaTarget = {
  readonly statusId: string;
  readonly n: number;
};

/** What {@link mediaOpen} needs to open one attachment. */
type MediaOpenSpec = MediaTarget & {
  readonly accountKey: string | null;
  /** How many attachments the post carries. */
  readonly total: number;
  /** The label the opening window gave the post, when it had one. */
  readonly label: string | null;
};

/** The bracketed label a title carries after `media`. */
const TITLE_LABEL = /^media \[([^\]]+)\] /u;

/** A 1-based index: digits with no leading zero. */
const INDEX = /^[1-9]\d*$/u;

/** The target of attachment {@link n} of the post {@link statusId}. */
export function mediaTarget(statusId: string, n: number): string {
  return `${statusId}:${String(n)}`;
}

/** The post and index a target names; null for anything that is not one. */
export function parseMediaTarget(target: string | null): MediaTarget | null {
  const at = target?.lastIndexOf(':') ?? -1;
  if (target === null || at < 1) {
    return null;
  }
  const digits = target.slice(at + 1);
  return INDEX.test(digits) ? { statusId: target.slice(0, at), n: Number(digits) } : null;
}

/** The title `media [c1] 1/3`, or `media 1/3` when the post has no known label. */
export function mediaTitle(label: string | null, n: number, total: number): string {
  const place = `${String(n)}/${String(total)}`;
  return label === null ? `media ${place}` : `media [${label}] ${place}`;
}

/** The window-list transition that opens (or activates) the window of one attachment. */
export function mediaOpen(spec: MediaOpenSpec): OpenAction {
  return {
    type: 'open',
    ref: {
      kind: 'media',
      accountKey: spec.accountKey,
      target: mediaTarget(spec.statusId, spec.n),
    },
    title: mediaTitle(spec.label, spec.n, spec.total),
  };
}

/** An attachment's place among the post's: the 1-based index and how many there are. */
type MediaPlace = { readonly n: number; readonly total: number };

/**
 * The transition that opens the attachment {@link place} of the post
 * {@link statusId}, a sibling of the one the media window {@link win} shows:
 * same account and the label its title carries.
 */
export function mediaSibling(win: WindowState, statusId: string, place: MediaPlace): OpenAction {
  const label = TITLE_LABEL.exec(win.title)?.[1] ?? null;
  return mediaOpen({ statusId, accountKey: win.ref.accountKey, ...place, label });
}

/**
 * The transitions that step the media window {@link win} to {@link place}: it
 * is made the active window so the pane that shows it takes the sibling, the
 * sibling is opened (and so shown there), and the window stepped from closes.
 */
export function mediaStep(win: WindowState, statusId: string, place: MediaPlace): WindowsAction[] {
  return [
    { type: 'activate', id: win.id },
    mediaSibling(win, statusId, place),
    { type: 'close', id: win.id },
  ];
}
