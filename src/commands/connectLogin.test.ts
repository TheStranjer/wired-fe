/**
 * Tests for /connect's discovery of the API host (WFE-343): a handle's domain
 * that does not serve the API is looked up through its NodeInfo, once, and
 * only where the user's own input picked the instance.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './defs/connect';
import type { CommandContext } from './types';
import type { WiredConfig } from '../config/schema';
import { fakeCommandContext } from '../test/commandContext';
import { server } from '../test/server';

const HANDLE = 'https://hyper.example';
const API = 'https://fedi.hyper.example';
const OPEN_BUILD: WiredConfig = { appName: 'WiredFE', instances: { mode: 'open' } };
const HINT =
  "If your handle's domain differs from your server's, connect to the server host shown in your profile URL.";

/** A context over {@link config} whose print and navigate record their calls. */
function stubContext(config: WiredConfig = OPEN_BUILD): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
  readonly navigate: Mock<CommandContext['navigate']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  const navigate: Mock<CommandContext['navigate']> = vi.fn();
  return { context: fakeCommandContext({ config, print, navigate }), print, navigate };
}

/** Answers app registration on {@link origin} with one client. */
function registers(origin: string): void {
  server.use(
    http.post(`${origin}/api/v1/apps`, () =>
      HttpResponse.json({ client_id: 'cid-1', client_secret: 'csecret-1' }),
    ),
  );
}

/** Makes app registration on {@link origin} answer {@link status}, or fail outright without one. */
function registrationFails(origin: string, status?: number): void {
  server.use(
    http.post(`${origin}/api/v1/apps`, () =>
      status === undefined ? HttpResponse.error() : HttpResponse.json({ error: 'No' }, { status }),
    ),
  );
}

/** Answers nodeinfo discovery on {@link origin} with {@link body}; the returned mock counts the requests. */
function nodeinfo(origin: string, body: JsonBodyType): Mock<() => void> {
  const asked = vi.fn<() => void>();
  server.use(
    http.get(`${origin}/.well-known/nodeinfo`, () => {
      asked();
      return HttpResponse.json(body);
    }),
  );
  return asked;
}

describe('/connect discovery', () => {
  it('asks nothing more when the typed origin works', async () => {
    registers(HANDLE);
    const asked = nodeinfo(HANDLE, { links: [] });
    const { context, print, navigate } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(asked).not.toHaveBeenCalled();
    expect(print.mock.calls).toStrictEqual([[`Opening ${HANDLE} to log in…`]]);
    expect(navigate.mock.calls[0]?.[0]).toMatch(new RegExp(`^${HANDLE}/oauth/authorize`, 'u'));
  });

  it('logs in at the origin nodeinfo names when the typed one fails', async () => {
    registrationFails(HANDLE);
    nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    registers(API);
    const { context, print, navigate } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([
      [`${HANDLE} serves its API at ${API}; connecting there`],
      [`Opening ${API} to log in…`],
    ]);
    expect(navigate.mock.calls[0]?.[0]).toMatch(new RegExp(`^${API}/oauth/authorize`, 'u'));
  });

  it('discovers through the host of a typed handle', async () => {
    registrationFails(HANDLE, 405);
    nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    registers(API);
    const { context, navigate } = stubContext();

    const outcome = await command.run('@news@hyper.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(navigate.mock.calls[0]?.[0]).toMatch(new RegExp(`^${API}/oauth/authorize`, 'u'));
  });

  it('does not discover for a listed host of a list build', async () => {
    const config: WiredConfig = {
      appName: 'WiredFE',
      instances: { mode: 'list', origins: [HANDLE], allowCustom: true },
    };
    registrationFails(HANDLE, 404);
    const asked = nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    const listed = stubContext(config);

    const outcome = await command.run('hyper.example', listed.context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Could not start login: HTTP 404: No',
    });
    expect(asked).not.toHaveBeenCalled();
  });

  it('discovers for an unlisted host of a list build that allows custom ones', async () => {
    const config: WiredConfig = {
      appName: 'WiredFE',
      instances: { mode: 'list', origins: [API], allowCustom: true },
    };
    registrationFails(HANDLE, 404);
    nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    registers(API);
    const { context, navigate } = stubContext(config);

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(navigate.mock.calls[0]?.[0]).toMatch(new RegExp(`^${API}/oauth/authorize`, 'u'));
  });

  it('reports the failure of the discovered origin without looking further', async () => {
    registrationFails(HANDLE);
    nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    registrationFails(API, 422);
    const { context, navigate } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Could not start login: HTTP 422: No' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('adds the hint when nodeinfo cannot be read', async () => {
    registrationFails(HANDLE);
    server.use(http.get(`${HANDLE}/.well-known/nodeinfo`, () => HttpResponse.error()));
    const { context, print, navigate } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toMatchObject({ ok: false });
    expect(outcome).toHaveProperty(
      'message',
      expect.stringMatching(/^Could not start login: Network error: [^\n]+\n/u),
    );
    expect(outcome).toHaveProperty('message', expect.stringContaining(`\n${HINT}`));
    expect(print).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('adds the hint when nodeinfo points to the same origin', async () => {
    registrationFails(HANDLE, 404);
    nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${HANDLE}/nodeinfo/2.1` }] });
    const { context } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `Could not start login: HTTP 404: No\n${HINT}`,
    });
  });

  it('does not discover for other refusals', async () => {
    registrationFails(HANDLE, 422);
    const asked = nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    const { context } = stubContext();

    const outcome = await command.run('hyper.example', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Could not start login: HTTP 422: No' });
    expect(asked).not.toHaveBeenCalled();
  });

  it('does not discover on a fixed build', async () => {
    registrationFails(HANDLE);
    const asked = nodeinfo(HANDLE, { links: [{ rel: 'x', href: `${API}/nodeinfo/2.1` }] });
    const { context } = stubContext({
      appName: 'WiredFE',
      instances: { mode: 'fixed', origin: HANDLE },
    });

    const outcome = await command.run('', context);

    expect(outcome.ok).toBe(false);
    expect(asked).not.toHaveBeenCalled();
  });
});
