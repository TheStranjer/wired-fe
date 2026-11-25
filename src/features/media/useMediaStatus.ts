/**
 * The one-shot load of a media window's post (WFE-263): the window keeps no
 * scrollback, so a restored or synced desk has nothing to show until the post
 * is fetched with `getStatus` as the window's own account, the way the thread
 * window loads its root. The result is `loading` until the instance answers,
 * `failed` with the words {@link describeApiError} has for it, or `ready` with
 * the post. A fetch cancelled with its window answers `loading`, which nothing
 * is left to show. A window with no signed-in owner asks for nothing and says so.
 */

import { useEffect, useState } from 'react';

import { getStatus } from '../../api/endpoints/statusRead';
import { describeApiError } from '../../api/errors';
import type { Status } from '../../api/schemas/status';
import { NOT_LOGGED_IN_MESSAGE } from '../../lib/refusal';
import { useRefreshDeps } from '../../state/RefreshContext';
import { type WithToken, withFreshToken } from '../../state/refreshSession';

/** Where the load stands. */
export type MediaLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly text: string }
  | { readonly kind: 'ready'; readonly status: Status };

/** The load before the instance has answered. */
const LOADING: MediaLoad = { kind: 'loading' };

/** What the instance answered for one post. */
type Answer = { readonly statusId: string; readonly load: MediaLoad };

/**
 * Fetch the post {@link statusId} with {@link withToken} and say where the
 * load stands: ready, failed with the error described, or still loading when
 * {@link signal} aborted it.
 */
export async function loadMediaStatus(
  withToken: WithToken,
  statusId: string,
  signal: AbortSignal,
): Promise<MediaLoad> {
  const result = await withToken(async (session) => await getStatus(session, statusId, signal));
  if (signal.aborted) {
    return LOADING;
  }
  return result.ok
    ? { kind: 'ready', status: result.value }
    : { kind: 'failed', text: describeApiError(result.error) };
}

/**
 * The post {@link statusId} as account {@link ownerKey} sees it. A null owner
 * is refused at once; a post other than the one last answered is `loading`.
 */
export function useMediaStatus(statusId: string, ownerKey: string | null): MediaLoad {
  const refresh = useRefreshDeps();
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (ownerKey !== null) {
      const withToken: WithToken = async (call) => await withFreshToken(refresh, ownerKey, call);
      void loadMediaStatus(withToken, statusId, controller.signal).then((load) => {
        setAnswer({ statusId, load });
      });
    }
    return () => {
      controller.abort();
    };
  }, [statusId, ownerKey, refresh]);

  if (ownerKey === null) {
    return { kind: 'failed', text: NOT_LOGGED_IN_MESSAGE };
  }
  return answer?.statusId === statusId ? answer.load : LOADING;
}
