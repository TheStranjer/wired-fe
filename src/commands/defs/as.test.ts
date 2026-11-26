/**
 * Tests for /as: the definition the registry reads, one post created through
 * the named account's own session (MSW checks the bearer token and the body)
 * at the reader's default visibility, the active account left untouched, and
 * the refusals: no text, an unknown account and an instance that says no.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './as';
import { accountKey } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import type { CommandContext } from '../types';

/** The instance both accounts live on. */
const ORIGIN = 'https://wired.example';

/** lain and bob: the active account and the one /as borrows. */
const LAIN = 'lain@wired.example';
const BOB = 'bob@wired.example';

/** What one create carried to the instance. */
type CreateCall = {
  readonly authorization: string | null;
  readonly idempotencyKey: string | null;
  readonly body: unknown;
};

/** A context with one account per handle in {@link handles}, the first active. */
function signedIn(handles: readonly string[]): CommandContext {
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
  context.stores.accounts.setActive(accountKey(ORIGIN, '1'));
  return context;
}

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

describe('/as', () => {
  it('declares its name, grammar and summary, and no hotkeys', () => {
    expect(command.name).toBe('as');
    expect(command.aliases).toBeUndefined();
    expect(command.usage).toBe('/as <handle|n> <text>');
    expect(command.summary).toBe('Post one line as another account');
    expect(command.bindings).toBeUndefined();
  });

  it('posts once with the numbered account token and reports it', async () => {
    const calls = serveCreate(status('new'));
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('2 hello there', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toStrictEqual({
      authorization: `Bearer token-${BOB}`,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { status: 'hello there', visibility: 'public' },
    });
    expect(context.print).toHaveBeenCalledWith('posted as @bob@wired.example');
  });

  it('leaves the active account where it was', async () => {
    serveCreate(status('new'));
    const context = signedIn([LAIN, BOB]);

    await command.run('@bob@wired.example second thoughts', context);

    expect(context.stores.accounts.activeKey()).toBe(accountKey(ORIGIN, '1'));
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('posts the rest of the line verbatim at the default visibility', async () => {
    const calls = serveCreate(status('new'));
    const start = signedIn([LAIN, BOB]);
    const state = appReducer(start.state, {
      type: 'settings',
      settings: { defaultVisibility: 'unlisted' },
    });

    await command.run('bob  Close the world.  Open the nExt ', { ...start, state });

    expect(calls[0]).toStrictEqual({
      authorization: `Bearer token-${BOB}`,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { status: 'Close the world.  Open the nExt', visibility: 'unlisted' },
    });
  });

  it('refuses an account nothing names, without touching the network', async () => {
    const context = signedIn([LAIN]);

    const outcome = await command.run('zzz hello', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `You aren't signed in as zzz. Signed in: @${LAIN}. Type /connect to add an account.`,
    });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses an account with no text to post', async () => {
    const context = signedIn([LAIN, BOB]);

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /as <handle|n> <text>',
    });
    await expect(command.run('2', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /as <handle|n> <text>',
    });
    await expect(command.run('2    ', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Usage: /as <handle|n> <text>',
    });
  });

  it('reports what the instance says about a failed post', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json({ error: 'Too many links' }, { status: 422 });
      }),
    );
    const context = signedIn([LAIN, BOB]);

    const outcome = await command.run('bob https://a.example https://b.example', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Too many links' });
    expect(context.print).not.toHaveBeenCalled();
  });
});
