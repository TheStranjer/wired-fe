/**
 * Tests for /dm: the definition the registry reads, one direct status created
 * through the active account's session (MSW checks the bearer token and the
 * body) and echoed the IRC way, the open dm window the answer also joins, and
 * the refusals: a first word that is not a handle, nothing to send, nobody
 * signed in, and an instance that says no.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './dm';
import type { Status } from '../../api/schemas/status';
import { appReducer } from '../../state/reducer';
import { LAIN, ORIGIN, keyOf, signedIn } from '../../test/accountWindows';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

/** The person every test messages, on somebody else's instance. */
const ALICE = '@alice@other.example';

/** What the command answers a line it cannot read with. */
const USAGE = { ok: false, message: 'Usage: /dm @user@host message' } as const;

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

/** The dm window a test opens for {@link target}, owned by the active account. */
function dmRef(target: string): WindowRef {
  return { kind: 'dm', accountKey: keyOf(1), target };
}

/** {@link context} with a dm window for {@link target} open, as the app would. */
function withDmWindow(context: CommandContext, target: string): CommandContext {
  const ref = dmRef(target);
  const state = appReducer(context.state, {
    type: 'windows',
    action: { type: 'open', ref, title: `dm ${target}` },
  });
  return { ...context, state, windows: state.windows };
}

describe('/dm', () => {
  it('declares its name, alias, grammar and summary, and no hotkeys', () => {
    expect(command.name).toBe('dm');
    expect(command.aliases).toStrictEqual(['msg']);
    expect(command.usage).toBe('/dm @user@host message');
    expect(command.summary).toBe('Send a direct message in one line');
    expect(command.bindings).toBeUndefined();
  });

  it('sends one direct status mentioning the handle, signed by the active account', async () => {
    const calls = serveCreate(status('new'));
    const context = signedIn([LAIN]);

    const outcome = await command.run(`${ALICE} Close the world.`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toStrictEqual({
      authorization: `Bearer token-${LAIN}`,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { status: `${ALICE} Close the world.`, visibility: 'direct' },
    });
  });

  it('echoes the message the IRC way', async () => {
    serveCreate(status('new'));
    const context = signedIn([LAIN]);

    await command.run(`${ALICE} Close the world.`, context);

    expect(context.print).toHaveBeenCalledWith(`-> *${ALICE}* Close the world.`);
  });

  it('adds the leading @ to a handle typed without one', async () => {
    const calls = serveCreate(status('new'));
    const context = signedIn([LAIN]);

    await command.run('alice@other.example   second  thoughts ', context);

    expect(calls[0]).toStrictEqual({
      authorization: `Bearer token-${LAIN}`,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { status: '@alice@other.example second  thoughts', visibility: 'direct' },
    });
    expect(context.print).toHaveBeenCalledWith('-> *@alice@other.example* second  thoughts');
  });

  it('sends a local handle as it stands', async () => {
    const calls = serveCreate(status('new'));
    const context = signedIn([LAIN]);

    await command.run('@alice hey', context);

    expect(calls[0]).toStrictEqual({
      authorization: `Bearer token-${LAIN}`,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { status: '@alice hey', visibility: 'direct' },
    });
  });

  it('adds the answer to the open dm window for that handle', async () => {
    const created = status('new');
    serveCreate(created);
    const context = withDmWindow(signedIn([LAIN]), ALICE);

    const outcome = await command.run(`${ALICE} Close the world.`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statuses',
      windowId: windowId(dmRef(ALICE)),
      statuses: [created],
      where: 'newer',
    });
  });

  it('finds the dm window whatever case its target was opened with', async () => {
    serveCreate(status('new'));
    const context = withDmWindow(signedIn([LAIN]), '@Alice@Other.Example');

    await command.run(`${ALICE} hi`, context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statuses',
      windowId: windowId(dmRef('@Alice@Other.Example')),
      statuses: [status('new')],
      where: 'newer',
    });
  });

  it('leaves the window list alone when no dm window is open', async () => {
    serveCreate(status('new'));
    const context = signedIn([LAIN]);

    await command.run(`${ALICE} hi`, context);

    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a first word that is not a handle, without touching the network', async () => {
    const context = signedIn([LAIN]);

    for (const args of ['a3 hello', 'hello there', 'Close the world.']) {
      await expect(command.run(args, context)).resolves.toStrictEqual(USAGE);
    }

    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses a handle with nothing to send', async () => {
    const context = signedIn([LAIN]);

    for (const args of ['', ALICE, `${ALICE}   `]) {
      await expect(command.run(args, context)).resolves.toStrictEqual(USAGE);
    }
  });

  it('refuses to send with nobody signed in', async () => {
    const context = fakeCommandContext();

    await expect(command.run(`${ALICE} hi`, context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('reports what the instance says about a failed send', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json({ error: 'Cannot message yourself' }, { status: 422 });
      }),
    );
    const context = withDmWindow(signedIn([LAIN]), ALICE);

    const outcome = await command.run(`${ALICE} hi`, context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Cannot message yourself' });
    expect(context.print).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
