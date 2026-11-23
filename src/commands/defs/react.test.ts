/**
 * Tests for /react over the shared MSW server: a Unicode emoji and a
 * `:shortcode:` leave for the encoded reactions path — the shortcode without
 * its colons — and the answered status replaces the post in every scrollback
 * while the window prints `🔥 reacted to [a0]`; the selection and a boost's
 * line answer as targets, the printed label included. An instance that turns
 * the reaction down is reported as the API error it is and changes nothing.
 * The refusals that send nothing live in ./react.refusals.test.ts.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { command } from './react';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { StatusSchema } from '../../api/schemas/status';
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
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The instance that serves both plain and custom emoji reactions. */
const REACTING: Capabilities = {
  backend: 'pleroma',
  maxCharacters: 5000,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(['emojiReactions', 'customEmojiReactions']),
};

/** The twelve fields every backend sends for the author of the test post. */
const ACCOUNT_WIRE = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain',
  created_at: '2026-11-01T00:00:00.000Z',
  note: '',
  url: 'https://wired.example/@lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** The post as the instance answers the PUT, with the fresh fire reaction on. */
const REACTED_WIRE = {
  id: 'p',
  uri: 'https://wired.example/n/p',
  created_at: '2026-11-12T18:00:00.000Z',
  account: ACCOUNT_WIRE,
  content: '<p>p</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
  pleroma: { emoji_reactions: [{ name: '🔥', count: 1, me: true }] },
};

/** {@link REACTED_WIRE} as the shared schema reads it. */
const REACTED = v.parse(StatusSchema, REACTED_WIRE);

/** A plain post for the scrollback, and a boost of it: line labels resolve. */
const POST = status('p');

/** A boost of {@link POST}: its label is the one the command prints. */
const BOOST = status('b', { reblog: POST });

/** The PUT of the reactions path, checking auth and path, answering {@link body}. */
function putReactions(expectedPath: string, body: Record<string, unknown>): void {
  server.use(
    http.put(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe(expectedPath);

      return HttpResponse.json(body);
    }),
  );
}

/**
 * The signed-in state with lain's home window showing {@link posts} (API
 * order, newest first) and {@link selectedId} selected when one is given.
 */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const profile: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities: REACTING };
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

describe('/react', () => {
  it('sends a Unicode emoji and shares the answered status', async () => {
    putReactions('/api/v1/pleroma/statuses/p/reactions/%F0%9F%94%A5', REACTED_WIRE);
    const context = homeContext([POST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: REACTED });
    expect(context.print).toHaveBeenCalledWith('🔥 reacted to [a0]');
  });

  it('sends a shortcode without its colons and prints it as typed', async () => {
    putReactions('/api/v1/pleroma/statuses/p/reactions/blob', {
      ...REACTED_WIRE,
      pleroma: { emoji_reactions: [{ name: 'blob', count: 1, me: true }] },
    });
    const context = homeContext([POST]);

    const outcome = await command.run('a0 :blob:', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(':blob: reacted to [a0]');
  });

  it('reacts to the selected post and names it by its label', async () => {
    putReactions('/api/v1/pleroma/statuses/p/reactions/%F0%9F%94%A5', REACTED_WIRE);
    const context = homeContext([POST], 'p');

    const outcome = await command.run('🔥', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('🔥 reacted to [a0]');
  });

  it('reacts to the original of a boost under the boost line label', async () => {
    putReactions('/api/v1/pleroma/statuses/p/reactions/%F0%9F%94%A5', REACTED_WIRE);
    const context = homeContext([BOOST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('🔥 reacted to [a0]');
  });

  it('reports the instance turning the reaction down', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );
    const context = homeContext([POST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 404: Record not found' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
