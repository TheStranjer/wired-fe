/**
 * Tests for `/edit` with no text on the line, over the shared MSW server: the
 * post's source — the plain text its author wrote — is read from
 * `GET /api/v1/statuses/<id>/source` and filled back into the command line as
 * `/edit a0 <that text>`, the label of the line that shows the post included and
 * nothing dispatched or printed, so the user finishes the line in insert mode.
 * A boost fills the label of the boost line it stands on. A source read the
 * instance turns down is reported as the API error it is and fills nothing.
 * Sending the edit lives in ./edit.test.ts, the refusals in
 * ./edit.refusals.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './edit';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { type Capabilities, DEFAULT_POLL_LIMITS } from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The instance that takes edits (decision 5). */
const EDITING: Capabilities = {
  backend: 'wired',
  maxCharacters: 5000,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(['editing']),
};

/** Lain's own post, and a boost of it: the line the label names. */
const MINE = status('p');

const BOOST = status('b', { reblog: MINE });

/** The source read of the status path, answering {@link body}. */
function getSource(body: Record<string, unknown>): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/statuses/:id/source`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe('/api/v1/statuses/p/source');

      return HttpResponse.json(body);
    }),
  );
}

/**
 * The signed-in state on an editing instance, lain's home window showing
 * {@link posts} (API order, newest first) and {@link selectedId} selected when
 * one is given.
 */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const profile: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities: EDITING };
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

/** A context whose active window shows {@link posts}, {@link selectedId} selected. */
function homeContext(posts: readonly Status[], selectedId: string | null = null): CommandContext {
  const state = homeState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/edit without text', () => {
  it('fills the command line with the source text the instance answers', async () => {
    getSource({ id: 'p', text: 'what lain wrote', spoiler_text: 'warning' });
    const context = homeContext([MINE]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.setInput).toHaveBeenCalledWith('/edit a0 what lain wrote');
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('fills the line for the selected post and for a boost original', async () => {
    getSource({ id: 'p', text: 'raw', spoiler_text: '' });
    const context = homeContext([BOOST], 'b');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.setInput).toHaveBeenCalledWith('/edit a0 raw');
  });

  it('reports a source read the instance turns down', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/:id/source`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 403 });
      }),
    );
    const context = homeContext([MINE]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 403: Record not found' });
    expect(context.setInput).not.toHaveBeenCalled();
  });
});
