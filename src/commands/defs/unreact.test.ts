/**
 * Tests for /unreact over the shared MSW server: the same grammar as /react,
 * sent as a DELETE on the path the reaction arrived on — a Unicode emoji as
 * typed, a `:shortcode:` without its colons — the answered status shared with
 * every scrollback and the window printing `🔥 unreacted to [a0]`. The
 * capability refusals name the missing flag without a request, and the
 * usage echoes the /unreact grammar.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { command } from './unreact';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { StatusSchema } from '../../api/schemas/status';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
import { initialAppState } from '../../state/appState';
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

/** The instance with only the flags a test names. */
function capsWith(...flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend: 'pleroma',
    maxCharacters: 5000,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>(flags),
  };
}

/** The post as the wire has it, carrying one fire reaction from lain. */
const POST_WIRE = {
  id: 'p',
  uri: 'https://wired.example/n/p',
  created_at: '2026-11-12T18:00:00.000Z',
  account: {
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
  },
  content: '<p>p</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
  pleroma: { emoji_reactions: [{ name: '🔥', count: 1, me: true }] },
};

/** {@link POST_WIRE} without the reaction: the answer to the DELETE. */
const CLEAN_WIRE = { ...POST_WIRE, pleroma: {} };

/** The scrollback post and the parsed answers the endpoint is checked against. */
const POST = status('p', { pleroma: { emoji_reactions: [{ name: '🔥', count: 1, me: true }] } });

const CLEAN = v.parse(StatusSchema, CLEAN_WIRE);

/** The both-flags capabilities every accepted command runs against. */
const REACTING = capsWith('emojiReactions', 'customEmojiReactions');

/** The reactions endpoint: DELETE answering {@link body}. */
function deleteReactions(expectedPath: string, body: Record<string, unknown>): void {
  server.use(
    http.delete(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe(expectedPath);

      return HttpResponse.json(body);
    }),
  );
}

/** The signed-in, detected state with lain's home window showing {@link posts}. */
function homeContext(capabilities: Capabilities, posts: readonly Status[]): CommandContext {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const profile: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities };
  const detected = appReducer(signedIn, { type: 'profile', profile });
  const opened = appReducer(detected, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const state = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/unreact', () => {
  it('DELETEs the encoded reaction path and shares the answered status', async () => {
    deleteReactions('/api/v1/pleroma/statuses/p/reactions/%F0%9F%94%A5', CLEAN_WIRE);
    const context = homeContext(REACTING, [POST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: CLEAN });
    expect(context.print).toHaveBeenCalledWith('🔥 unreacted to [a0]');
  });

  it('sends a shortcode without its colons and prints it as typed', async () => {
    deleteReactions('/api/v1/pleroma/statuses/p/reactions/blob', CLEAN_WIRE);
    const context = homeContext(REACTING, [POST]);

    const outcome = await command.run('a0 :blob:', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(':blob: unreacted to [a0]');
  });

  it('refuses any un-reaction on an instance without emojiReactions', async () => {
    const context = homeContext(capsWith(), [POST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server (Pleroma) can't react to posts with emoji",
    });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses a shortcode on an instance without customEmojiReactions', async () => {
    const context = homeContext(capsWith('emojiReactions'), [POST]);

    const outcome = await command.run('a0 :blob:', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server (Pleroma) can't react with custom emoji",
    });
  });

  it('echoes the usage when the emoji is missing', async () => {
    const context = homeContext(REACTING, [POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /unreact [label] <emoji>' });
  });

  it('reports the instance turning the removal down', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );
    const context = homeContext(REACTING, [POST]);

    const outcome = await command.run('a0 🔥', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 404: Record not found' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
