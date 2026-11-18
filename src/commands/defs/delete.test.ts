/**
 * Tests for /delete (alias /del) over the shared MSW server: one of this
 * account's own posts leaves as a DELETE of its status path, its id is
 * broadcast as `statusDeleted` so every scrollback drops the line, and the
 * window prints `✗ deleted [a0]` — the label of the line that showed the post,
 * the boost line's own label when the post arrives boosted. The navigation
 * selection answers as a target with no label given. A post of somebody else's
 * is refused with nothing sent at all, and an instance that answers the delete
 * with an error is reported as that error and changes nothing.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './delete';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status, TEST_DATE } from '../../test/fixtures';
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

/** The twelve wire fields of the account that wrote {@link HERS}. */
const ALICE_WIRE = {
  id: '2',
  username: 'alice',
  acct: 'alice@wired.example',
  display_name: 'Alice',
  created_at: TEST_DATE,
  note: '',
  url: 'https://wired.example/@alice',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** A post lain wrote, one alice wrote, and boosts of both. */
const MINE = status('p');

const HERS = status('q', { account: ALICE_WIRE });

/** Lain's boost of her own post: the line carries the post she wrote. */
const MY_BOOST = status('b', { reblog: MINE });

/** Lain's boost of alice's post: the original is alice's to delete. */
const HER_BOOST = status('c', { reblog: HERS });

/** Another of lain's posts, for the selection to stand on. */
const OTHER = status('o');

/** The DELETE of the status path, checking auth and path, answering {@link body}. */
function deleteEndpoint(body: Record<string, unknown>): void {
  server.use(
    http.delete(`${ORIGIN}/api/v1/statuses/:id`, ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer token');
      expect(new URL(request.url).pathname).toBe('/api/v1/statuses/p');

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

describe('/delete', () => {
  it('deletes the labelled post and tells every scrollback its id', async () => {
    deleteEndpoint(MINE);
    const context = homeContext([MINE]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusDeleted', id: 'p' });
    expect(context.print).toHaveBeenCalledWith('✗ deleted [a0]');
  });

  it('deletes the selected post when the line carries no label', async () => {
    deleteEndpoint(MINE);
    const context = homeContext([OTHER, MINE], 'p');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusDeleted', id: 'p' });
    expect(context.print).toHaveBeenCalledWith('✗ deleted [a0]');
  });

  it('deletes the original of a boost and names the boost line', async () => {
    deleteEndpoint(MINE);
    const context = homeContext([MY_BOOST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusDeleted', id: 'p' });
    expect(context.print).toHaveBeenCalledWith('✗ deleted [a0]');
  });

  it('refuses a post of somebody else and sends nothing', async () => {
    const context = homeContext([HERS]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only delete your own posts' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses the original of a boost of somebody else post', async () => {
    const context = homeContext([HER_BOOST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'You can only delete your own posts' });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('reports the instance turning the delete down', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/statuses/:id`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 403 });
      }),
    );
    const context = homeContext([MINE]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 403: Record not found' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });
});
