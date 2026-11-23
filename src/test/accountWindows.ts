/**
 * The signed-in multi-account context the `/account` tests share (AGENTS.md
 * "Testing"): one account per handle, added in order and each owning one
 * home window, the first active, and — unless a test says otherwise — the
 * instance's OAuth app already cached so logout revokes without registering.
 * Building the window list through the real reducer means a command sees
 * exactly what the app would have shown it. {@link serveRevoke} stands in
 * for the instance's revoke endpoint and records the bodies it was sent.
 */
import { HttpResponse, http } from 'msw';

import { fakeCommandContext } from './commandContext';
import { server } from './server';
import { accountKey } from '../accounts/accountStore';
import type { CommandContext } from '../commands/types';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { type WindowRef, windowId } from '../windows/model';

/** The instance the account tests sign in to; also the stub page's origin. */
export const ORIGIN = 'https://wired.example';

/** lain and bob: the handles the account tests sign in under. */
export const LAIN = 'lain@wired.example';
export const BOB = 'bob@wired.example';

/** The stored key of the account numbered {@link n} in {@link signedIn}. */
export function keyOf(n: number): string {
  return accountKey(ORIGIN, String(n));
}

/** The id of the home window the account numbered {@link n} owns. */
export function homeWindowId(n: number): string {
  const ref: WindowRef = { kind: 'home', accountKey: keyOf(n), target: null };
  return windowId(ref);
}

/**
 * A context signed in to one account per handle in {@link handles} (the
 * first active, each owning a home window), with the instance's app cached —
 * unless {@link appCached} is false, for revokes that must not get a client.
 */
export function signedIn(handles: readonly string[], appCached = true): CommandContext {
  const context = fakeCommandContext();
  for (const [index, handle] of handles.entries()) {
    context.stores.accounts.add({
      origin: ORIGIN,
      accountId: String(index + 1),
      handle,
      token: `token-${handle}`,
      refreshToken: null,
      expiresAt: null,
    });
  }
  context.stores.accounts.setActive(keyOf(1));
  if (appCached) {
    context.stores.apps.set(`${ORIGIN} ${ORIGIN}/`, {
      client_id: 'cid',
      client_secret: 'csecret',
    });
  }
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: context.stores.accounts.list(),
    activeKey: context.stores.accounts.activeKey(),
  });
  for (const [index, handle] of handles.entries()) {
    const ref: WindowRef = { kind: 'home', accountKey: keyOf(index + 1), target: null };
    state = appReducer(state, {
      type: 'windows',
      action: { type: 'open', ref, title: `home:${handle}` },
    });
  }
  return { ...context, state, windows: state.windows };
}

/** Answers every revoke with success, recording the bodies it is sent. */
export function serveRevoke(): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${ORIGIN}/oauth/revoke`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({});
    }),
  );
  return bodies;
}

/** Answers every revoke with a flat 500 refusal, recording the bodies sent. */
export function serveRevokeRefused(): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${ORIGIN}/oauth/revoke`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ error: 'nope' }, { status: 500 });
    }),
  );
  return bodies;
}
