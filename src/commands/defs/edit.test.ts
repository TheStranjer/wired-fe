/**
 * Tests for /edit with text on the line, over the shared MSW server: the new
 * body leaves as a PUT of the status path with the post's own content warning
 * riding along, and the answered status replaces the post in every scrollback
 * while the window prints `✎ edited [a0]` — the navigation selection and a
 * boost's line answer as targets, the printed label included. An instance that
 * turns the edit down is reported as the API error it is and changes nothing.
 * Filling the line from the post's source lives in ./edit.source.test.ts, the
 * refusals that send nothing in ./edit.refusals.test.ts.
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

/** Lain's own post, under a content warning the edit has to keep. */
const MINE = status('p', { spoiler_text: 'warning' });

/** A boost of {@link MINE}: its line is the one the command names. */
const BOOST = status('b', { reblog: MINE });

/** Another of lain's posts, newer than {@link MINE} and so labelled after it. */
const OTHER = status('o');

/** The status as the instance answers the PUT: lain's text, `edited_at` set. */
const EDITED = { ...MINE, content: '<p>new text</p>', edited_at: '2026-11-12T21:15:00.000Z' };

/** The PUT of the status path, expecting {@link text} and answering {@link body}. */
function putStatus(text: string, body: Record<string, unknown>): void {
  server.use(
    http.put(`${ORIGIN}/api/v1/statuses/:id`, async ({ request }) => {
      const json: unknown = await request.json();

      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe('/api/v1/statuses/p');
      expect(json).toStrictEqual({ status: text, spoiler_text: 'warning' });

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

describe('/edit with text', () => {
  it('sends the new text and keeps the post content warning', async () => {
    putStatus('new text', EDITED);
    const context = homeContext([MINE]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: EDITED });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
    expect(context.setInput).not.toHaveBeenCalled();
  });

  it('edits the selected post when the line carries no label', async () => {
    putStatus('new text', EDITED);
    const context = homeContext([OTHER, MINE], 'p');

    const outcome = await command.run('new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
  });

  it('edits the original of a boost and names the boost line', async () => {
    putStatus('new text', EDITED);
    const context = homeContext([BOOST]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: EDITED });
    expect(context.print).toHaveBeenCalledWith('✎ edited [a0]');
  });

  it('reports the instance turning the edit down', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/statuses/:id`, () => {
        return HttpResponse.json({ error: 'Cannot edit a reblog' }, { status: 422 });
      }),
    );
    const context = homeContext([MINE]);

    const outcome = await command.run('a0 new text', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Cannot edit a reblog' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
