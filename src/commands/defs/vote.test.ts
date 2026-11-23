/**
 * Tests for /vote over the shared MSW server: the ballots. A single-choice and
 * a multiple-choice ballot leave as their zero-based indexes in the typed
 * order, print the one-based tally, and replace the status in the scrollbacks
 * with the poll the instance answers; the navigation selection and a boost's
 * line answer as targets, the printed label included. An instance that turns
 * the ballot down is reported and changes nothing.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { command } from './vote';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Poll } from '../../api/schemas/poll';
import { PollSchema } from '../../api/schemas/poll';
import type { Status } from '../../api/schemas/status';
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

/** The open two-option single-choice poll as the wire sends it. */
const POLL_WIRE = {
  id: 'poll1',
  expires_at: '2026-11-20T12:00:00.000Z',
  expired: false,
  multiple: false,
  votes_count: 42,
  options: [
    { title: 'Tabs', votes_count: 25 },
    { title: 'Spaces', votes_count: 17 },
  ],
  voted: false,
  own_votes: [],
  emojis: [],
};

/** The poll as the instance answers a ballot for option index 1. */
const ANSWER: Poll = v.parse(PollSchema, { ...POLL_WIRE, voted: true, own_votes: [1] });

/** A post carrying {@link POLL_WIRE}. */
const WITH_POLL = status('p', { poll: POLL_WIRE });

/** The same poll on a multiple-choice post. */
const MULTIPLE = status('m', { poll: { ...POLL_WIRE, multiple: true } });

/** A post with no poll at all. */
const NO_POLL = status('n');

/** A boost of WITH_POLL: voting through its label names the boost line. */
const BOOST = status('b', { reblog: WITH_POLL });

/** The votes endpoint, answering {@link body} and checking the posted indexes. */
function votesEndpoint(expected: readonly number[], body: Record<string, unknown>): void {
  server.use(
    http.post(`${ORIGIN}/api/v1/polls/poll1/votes`, async ({ request }) => {
      const json: unknown = await request.json();

      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(json).toStrictEqual({ choices: expected });

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
  const opened = appReducer(signedIn, {
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

describe('/vote ballots', () => {
  it('casts a single-choice ballot and shares the updated poll', async () => {
    votesEndpoint([1], ANSWER);
    const context = homeContext([WITH_POLL]);

    const outcome = await command.run('a0 2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statusUpdated',
      status: { ...WITH_POLL, poll: ANSWER },
    });
    expect(context.print).toHaveBeenCalledWith('voted 2 on [a0]');
  });

  it('sends every option of a multiple-choice ballot in the typed order', async () => {
    votesEndpoint([1, 0], { ...POLL_WIRE, multiple: true, voted: true, own_votes: [1, 0] });
    const context = homeContext([MULTIPLE]);

    const outcome = await command.run('a0 2 1', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statusUpdated',
      status: {
        ...MULTIPLE,
        poll: v.parse(PollSchema, { ...POLL_WIRE, multiple: true, voted: true, own_votes: [1, 0] }),
      },
    });
    expect(context.print).toHaveBeenCalledWith('voted 2 1 on [a0]');
  });

  it('votes on the selected post and names it by its label', async () => {
    votesEndpoint([0], { ...POLL_WIRE, voted: true, own_votes: [0] });
    const context = homeContext([NO_POLL, WITH_POLL], 'p');

    const outcome = await command.run('1', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith('voted 1 on [a0]');
  });

  it('votes on the original of a boost under the boost line label', async () => {
    votesEndpoint([1], ANSWER);
    const context = homeContext([BOOST]);

    const outcome = await command.run('a0 2', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statusUpdated',
      status: { ...WITH_POLL, poll: ANSWER },
    });
    expect(context.print).toHaveBeenCalledWith('voted 2 on [a0]');
  });

  it('reports the instance turning the ballot down', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/:id/votes`, () => {
        return HttpResponse.json({ error: 'Already voted' }, { status: 422 });
      }),
    );
    const context = homeContext([WITH_POLL]);

    const outcome = await command.run('a0 2', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Already voted' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
