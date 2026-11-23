/**
 * The shared setup of the `/edit` send tests: lain signed in on an instance
 * that takes edits (decision 5), her home window showing a list of posts, and
 * the MSW handler for the PUT of the status path that checks the body the
 * command sent.
 */

import { HttpResponse, http } from 'msw';
import { expect } from 'vitest';

import { fakeCommandContext } from './commandContext';
import { server } from './server';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import type { CommandContext } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { type WindowRef, windowId } from '../windows/model';

/** The instance every `/edit` test talks to. */
export const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The detected instance, as the reducer's `profile` action carries it. */
type Profile = Extract<AppAction, { type: 'profile' }>['profile'];

/**
 * The signed-in state on the instance {@link profile} describes, lain's home
 * window showing {@link posts} (API order, newest first) and {@link selectedId}
 * selected when one is given.
 */
function homeState(
  profile: Profile,
  posts: readonly Status[],
  selectedId: string | null,
): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const detected = appReducer(signedIn, { type: 'profile', profile });
  const opened = appReducer(detected, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  if (selectedId === null) {
    return filled;
  }
  return appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
}

/** A context on {@link profile} whose active window shows {@link posts}, {@link selectedId} selected. */
export function homeContext(
  profile: Profile,
  posts: readonly Status[],
  selectedId: string | null = null,
): CommandContext {
  const state = homeState(profile, posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

/**
 * The PUT of the status path, expecting {@link text} with the post's warning
 * and {@link extra} (the `sensitive`, `media_ids` and further fields the
 * command keeps) and answering {@link body}.
 */
export function putStatus(
  text: string,
  body: Record<string, unknown>,
  extra: Record<string, unknown> = { sensitive: false, media_ids: [] },
): void {
  server.use(
    http.put(`${ORIGIN}/api/v1/statuses/:id`, async ({ request }) => {
      const json: unknown = await request.json();

      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe('/api/v1/statuses/p');
      expect(json).toStrictEqual({ status: text, spoiler_text: 'warning', ...extra });

      return HttpResponse.json(body);
    }),
  );
}
