/**
 * The shared session of the /quote tests (WFE-262): lain signed in on the
 * wired instance with a window of any kind open and showing posts, an instance
 * that does or does not carry `quotePosting`, and a stub of the instance's
 * status create that records what reached it.
 */
import { HttpResponse, http } from 'msw';

import { fakeCommandContext } from './commandContext';
import { status } from './fixtures';
import { server } from './server';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import type { CommandContext } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { type WindowRef, windowId } from '../windows/model';

/** What a detected instance can do, as the app state stores it. */
type Detected =
  AppState['profiles'] extends ReadonlyMap<string, infer P>
    ? P extends { readonly capabilities: infer C }
      ? C
      : never
    : never;

export const ORIGIN = 'https://wired.example';

/** The signed-in account whose windows show the posts. */
export const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window. */
export const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

/** A plain post for the scrollback; its label is the one the command prints. */
export const POST = status('p');

/** A boost of {@link POST}: quoting it quotes the original under `a0`. */
export const BOOST = status('b', { reblog: POST });

/** What the session shows: the active window, its posts, the instance's features and the settings. */
export type Session = {
  readonly ref: WindowRef;
  readonly posts: readonly Status[];
  /** The instance's capabilities; null when they were never detected. */
  readonly capabilities: Detected | null;
  readonly selectedId?: string;
  readonly settings?: Settings;
};

/** The signed-in state with the window of {@link session} active and showing its posts. */
function sessionState(session: Session): AppState {
  const settled = appReducer(initialAppState(), {
    type: 'settings',
    settings: session.settings ?? DEFAULT_SETTINGS,
  });
  const signedIn = appReducer(settled, {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const withProfile =
    session.capabilities === null
      ? signedIn
      : appReducer(signedIn, {
          type: 'profile',
          profile: { origin: ORIGIN, title: 'Wired', capabilities: session.capabilities },
        });
  const opened = appReducer(withProfile, {
    type: 'windows',
    action: { type: 'open', ref: session.ref, title: session.ref.kind },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: windowId(session.ref),
    statuses: session.posts,
    where: 'newer',
  });
  return session.selectedId === undefined
    ? filled
    : appReducer(filled, {
        type: 'select',
        windowId: windowId(session.ref),
        key: `post:${session.selectedId}`,
      });
}

/** A command context over {@link session}. */
export function sessionContext(session: Session): CommandContext {
  const state = sessionState(session);
  return fakeCommandContext({ state, windows: state.windows });
}

/** What one create carried to the instance. */
export type CreateCall = {
  readonly authorization: string | null;
  readonly body: unknown;
};

/** Answers every status create with {@link answered}, recording the requests. */
export function serveCreate(answered: Status): CreateCall[] {
  const calls: CreateCall[] = [];
  server.use(
    http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
      calls.push({
        authorization: request.headers.get('Authorization'),
        body: await request.json(),
      });
      return HttpResponse.json(answered);
    }),
  );
  return calls;
}

/** The create as it reached the instance: lain's token and exactly {@link body}. */
export function createCarried(body: Record<string, unknown>): CreateCall {
  return { authorization: 'Bearer token', body };
}
