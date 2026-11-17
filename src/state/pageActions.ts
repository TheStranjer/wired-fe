/**
 * The constructors for the page-related buffer actions every loader shares
 * (AGENTS.md "Layout": src/state is the pure app state): the load a window's
 * buffer walks through while a page is fetched, and one arrived page of
 * statuses. Builders, not behaviour — the reducer still owns what they do.
 */

import type { BufferLoad } from './buffer';
import type { BufferAction } from './bufferActions';
import type { Where } from './bufferPosts';
import type { PageCursor } from '../api/pagination';
import type { Status } from '../api/schemas/status';

/** The paging fields that ride along with a finished load. */
export type LoadPage = {
  readonly olderCursor?: PageCursor | null;
  readonly exhausted?: boolean;
};

/**
 * The action that moves one window's load along: `loading` as a page goes
 * out, `loaded` or `error` as it comes back, with {@link page} carrying an
 * arrived page's cursor and exhausted flag.
 */
export function loadAction(windowId: string, load: BufferLoad, page?: LoadPage): LoadAction {
  return { type: 'load', windowId, load, ...(page ?? {}) };
}

/** The action that delivers one fetched page of statuses to a window. */
export function statusesAction(
  windowId: string,
  statuses: readonly Status[],
  where: Where,
): StatusesAction {
  return { type: 'statuses', windowId, statuses, where };
}

/** The load action, named for {@link loadAction}'s return. */
type LoadAction = Extract<BufferAction, { readonly type: 'load' }>;

/** The statuses action, named for {@link statusesAction}'s return. */
type StatusesAction = Extract<BufferAction, { readonly type: 'statuses' }>;
