/**
 * Tests for /connect: a same-origin build logs into the page's own instance, an
 * open build refuses without an argument and takes the typed one, and a refused
 * app registration is reported instead of navigated to. App registration is
 * mocked with MSW; the context's `navigate` and `print` record every call.
 */
import { HttpResponse, http } from 'msw';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command } from './connect';
import { OAUTH_SCOPES } from '../../api/oauth';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  NO_ANONYMOUS_READS,
} from '../../capabilities/capabilities';
import { cacheProfile, readCachedProfile } from '../../capabilities/profileCache';
import type { WiredConfig } from '../../config/schema';
import { fakeCommandContext } from '../../test/commandContext';
import { server } from '../../test/server';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** A build that talks to whatever the user types (decision 3). */
const OPEN_BUILD: WiredConfig = { appName: 'WiredFE', instances: { mode: 'open' } };

/** The capabilities of the instance whose profile the cache tests keep. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(),
  anonymousReads: NO_ANONYMOUS_READS,
};

/** Answers `POST <origin>/api/v1/apps` with one client. */
function mockRegistration(origin: string): void {
  server.use(
    http.post(`${origin}/api/v1/apps`, () =>
      HttpResponse.json({ client_id: 'cid-1', client_secret: 'csecret-1' }),
    ),
  );
}

/** A context whose print and navigate record their calls, over {@link overrides}. */
function stubContext(overrides: Partial<CommandContext> = {}): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
  readonly navigate: Mock<CommandContext['navigate']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  const navigate: Mock<CommandContext['navigate']> = vi.fn();
  return { context: fakeCommandContext({ print, navigate, ...overrides }), print, navigate };
}

/** What one navigation asked for: where, and every query parameter it carries. */
type Authorization = {
  readonly origin: string;
  readonly pathname: string;
  readonly params: Record<string, string>;
};

/** The single request /connect navigated to, failing the test when it navigated nowhere. */
function authorization(navigate: Mock<CommandContext['navigate']>): Authorization {
  const url = navigate.mock.calls[0]?.[0];
  if (url === undefined) {
    throw new Error('/connect did not navigate anywhere');
  }
  const parsed = new URL(url);
  return {
    origin: parsed.origin,
    pathname: parsed.pathname,
    params: Object.fromEntries(parsed.searchParams),
  };
}

/** The code-flow parameters of a login started with client `cid-1` back to {@link redirectUri}. */
function authorizeParams(redirectUri: string): Record<string, unknown> {
  return {
    response_type: 'code',
    client_id: 'cid-1',
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPES,
    state: expect.stringMatching(/^[0-9a-f]{32}$/),
  };
}

describe('/connect', () => {
  it('sends a same-origin build to the page origin authorize page', async () => {
    mockRegistration(ORIGIN);
    const { context, print, navigate } = stubContext();

    const outcome = await command.run('', context);
    const request = authorization(navigate);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([[`Opening ${ORIGIN} to log in…`]]);
    expect(request.origin).toBe(ORIGIN);
    expect(request.pathname).toBe('/oauth/authorize');
    expect(request.params).toStrictEqual(authorizeParams(`${ORIGIN}/`));
  });

  it('drops the instance profile cached for the session so the next detection is fresh', async () => {
    mockRegistration(ORIGIN);
    const { context } = stubContext();
    const { profiles } = context.stores;
    cacheProfile(profiles, { origin: ORIGIN, title: 'Lounge', capabilities: CAPABILITIES }, 1);

    await command.run('', context);

    expect(readCachedProfile(profiles, ORIGIN)).toBeUndefined();
  });

  it('keeps the cached profile when the instance is refused', async () => {
    const { context } = stubContext({ config: OPEN_BUILD });
    const { profiles } = context.stores;
    cacheProfile(profiles, { origin: ORIGIN, title: 'Lounge', capabilities: CAPABILITIES }, 1);

    await command.run('', context);

    expect(readCachedProfile(profiles, ORIGIN)?.title).toBe('Lounge');
  });

  it('asks an open build for an instance when none was typed', async () => {
    const { context, print, navigate } = stubContext({ config: OPEN_BUILD });

    const outcome = await command.run('   ', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Enter an instance, like wired.example' });
    expect(print).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends an open build to the instance it was given', async () => {
    mockRegistration(ORIGIN);
    const { context, print, navigate } = stubContext({
      config: OPEN_BUILD,
      page: { origin: 'https://fe.example', pathname: '/wired/' },
    });

    const outcome = await command.run(' wired.example ', context);
    const request = authorization(navigate);

    expect(outcome).toStrictEqual({ ok: true });
    expect(print.mock.calls).toStrictEqual([[`Opening ${ORIGIN} to log in…`]]);
    expect(request.origin).toBe(ORIGIN);
    expect(request.pathname).toBe('/oauth/authorize');
    expect(request.params).toStrictEqual(authorizeParams('https://fe.example/wired/'));
  });

  it('reports a refused registration without navigating', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, () =>
        HttpResponse.json({ error: 'Registration refused' }, { status: 422 }),
      ),
    );
    const { context, print, navigate } = stubContext();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Could not start login: HTTP 422: Registration refused',
    });
    expect(print).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
