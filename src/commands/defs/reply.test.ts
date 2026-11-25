/**
 * Tests for /reply: the label and the navigation selection resolve to the
 * answered post — a boost answers its original under the boost line's label —
 * and the instance receives one create carrying the replyDraft body (MSW
 * checks the bearer token, the idempotency key and the payload): the
 * respondents @-named, the answered id, the kept audience and the carried
 * content warning. The fresh answer joins the active home window's
 * scrollback as newer and the window prints `↳ replied to [a0]`. The
 * refusals, and the placement into thread, dm and status windows, are in
 * ./reply.refusals.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './reply';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { TEST_DATE, status } from '../../test/fixtures';
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

/** Nine: the author every test answers, on somebody else's instance. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** The mention wire object alice arrives as. */
const ALICE = {
  id: 'al',
  username: 'alice',
  acct: 'alice@wired.example',
  url: 'https://wired.example/@alice',
};

/** Nine's public post mentioning alice: the line the command labels `a0`. */
const POST = status('7', { account: NINE_WIRE, mentions: [ALICE] });

/** A boost of {@link POST}: answering it answers the original under `a0`. */
const BOOST = status('b', { reblog: POST });

/** What one create carried to the instance. */
type CreateCall = {
  readonly authorization: string | null;
  readonly idempotencyKey: string | null;
  readonly body: unknown;
};

/** Answers every status create with {@link answered}, recording the requests. */
function serveCreate(answered: Status): CreateCall[] {
  const calls: CreateCall[] = [];
  server.use(
    http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
      const body: unknown = await request.json();
      calls.push({
        authorization: request.headers.get('Authorization'),
        idempotencyKey: request.headers.get('Idempotency-Key'),
        body,
      });
      return HttpResponse.json(answered);
    }),
  );
  return calls;
}

/** What a create's idempotency key must look like: a fresh uuid. */
const IDEMPOTENCY_KEY: unknown = expect.stringMatching(/^[0-9a-f-]{36}$/u);

/** The create as it reached the instance: lain's token, a fresh key, {@link body}. */
function createCarried(body: Record<string, unknown>) {
  return { authorization: 'Bearer token', idempotencyKey: IDEMPOTENCY_KEY, body };
}

/** Lain's signed-in state whose active window is {@link ref}, showing {@link posts}. */
function feedState(ref: WindowRef, posts: readonly Status[]): CommandContext {
  const signedIn = fakeCommandContext();
  const withAccount = appReducer(signedIn.state, {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(withAccount, {
    type: 'windows',
    action: { type: 'open', ref, title: ref.kind },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: windowId(ref),
    statuses: posts,
    where: 'newer',
  });
  return { ...signedIn, state: filled, windows: filled.windows };
}

describe('/reply', () => {
  it('declares its name, alias, grammar, summary and r prefill and Shift+r composer bindings', () => {
    expect(command.name).toBe('reply');
    expect(command.aliases).toStrictEqual(['r']);
    expect(command.usage).toBe('/reply [label] [text]');
    expect(command.summary).toBe(
      'Reply in one line; with no text, open a composer (r prefills, Shift+r composes)',
    );
    expect(command.bindings).toStrictEqual([
      { mode: 'navigation', chord: 'r', args: '{label}', prefill: true },
      { mode: 'navigation', chord: 'Shift+r', args: '' },
    ]);
  });

  it('answers the labelled post, names its respondents and echoes the line', async () => {
    const created = status('reply');
    const calls = serveCreate(created);
    const context = feedState(HOME, [POST]);

    const outcome = await command.run('a0 hello there', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls[0]).toStrictEqual(
      createCarried({
        status: '@nine@pleroma.example @alice@wired.example hello there',
        visibility: 'public',
        in_reply_to_id: '7',
      }),
    );
    expect(context.print).toHaveBeenCalledWith('↳ replied to [a0]');
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statuses',
      windowId: windowId(HOME),
      statuses: [created],
      where: 'newer',
    });
  });

  it('answers the selected post and keeps the whole argument as text', async () => {
    const calls = serveCreate(status('reply'));
    const plain = feedState(HOME, [POST]);
    const state = appReducer(plain.state, {
      type: 'select',
      windowId: windowId(HOME),
      key: 'post:7',
    });
    const context: CommandContext = { ...plain, state };

    const outcome = await command.run('close the world', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls[0]).toStrictEqual(
      createCarried({
        status: '@nine@pleroma.example @alice@wired.example close the world',
        visibility: 'public',
        in_reply_to_id: '7',
      }),
    );
    expect(context.print).toHaveBeenCalledWith('↳ replied to [a0]');
  });

  it('answers the original of a boost under the boost line label', async () => {
    const calls = serveCreate(status('reply'));
    const context = feedState(HOME, [BOOST]);

    const outcome = await command.run('a0 deep thought', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls[0]).toStrictEqual(
      createCarried({
        status: '@nine@pleroma.example @alice@wired.example deep thought',
        visibility: 'public',
        in_reply_to_id: '7',
      }),
    );
    expect(context.print).toHaveBeenCalledWith('↳ replied to [a0]');
  });

  it('keeps a direct post direct and carries its content warning', async () => {
    const hush = status('7', {
      account: NINE_WIRE,
      visibility: 'direct',
      spoiler_text: 'lain spoilers',
    });
    const calls = serveCreate(status('reply'));
    const context = feedState(HOME, [hush]);

    await expect(command.run('a0 who is out there', context)).resolves.toStrictEqual({ ok: true });

    expect(calls[0]).toStrictEqual(
      createCarried({
        status: '@nine@pleroma.example who is out there',
        spoiler_text: 'lain spoilers',
        visibility: 'direct',
        in_reply_to_id: '7',
      }),
    );
  });
});
