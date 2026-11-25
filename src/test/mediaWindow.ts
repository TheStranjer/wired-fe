/**
 * The signed-in media window the media tests share (AGENTS.md "Testing"):
 * lain's account and one `media` window opened through the real reducers on a
 * post with two images, plus {@link serveMediaStatus}, which answers
 * `getStatus` over MSW. No handler answers what a test never served.
 */
import { HttpResponse, http } from 'msw';

import { status } from './fixtures';
import { server } from './server';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { mediaOpen } from '../state/mediaWindow';

/** The instance a media test signs in to and is answered by. */
export const MEDIA_ORIGIN = 'https://wired.example';

/** lain: the account the media window belongs to and fetches with. */
const MEDIA_ACCOUNT: StoredAccount = {
  key: accountKey(MEDIA_ORIGIN, '1'),
  origin: MEDIA_ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The wire form of one attachment of {@link type}, its full file and its preview. */
export function attachment(
  id: string,
  type = 'image',
  extras: Record<string, unknown> = {},
): object {
  return {
    id,
    type,
    url: `https://media.example/full/${id}`,
    preview_url: `https://media.example/small/${id}`,
    ...extras,
  };
}

/** A post with {@link attachments}: the one the served instance answers for id `p`. */
export function mediaPost(
  attachments: readonly object[],
  extras: Record<string, unknown> = {},
): Status {
  return status('p', { media_attachments: attachments, ...extras });
}

/** Serve {@link post} as status `p`; null answers 404. */
export function serveMediaStatus(post: Status | null): void {
  server.use(
    http.get(`${MEDIA_ORIGIN}/api/v1/statuses/p`, () =>
      post === null
        ? HttpResponse.json({ error: 'Record not found' }, { status: 404 })
        : HttpResponse.json(post),
    ),
  );
}

/** The signed-in state with the window of attachment {@link n} of {@link total} open and active. */
export function mediaState(n: number, total: number, signedIn = true): AppState {
  const accounts = signedIn ? [MEDIA_ACCOUNT] : [];
  const withAccount = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts,
    activeKey: signedIn ? MEDIA_ACCOUNT.key : null,
  });
  const open = mediaOpen({
    statusId: 'p',
    accountKey: MEDIA_ACCOUNT.key,
    n,
    total,
    label: 'a0',
  });
  return coreReducer(withAccount, { type: 'windows', action: open });
}
