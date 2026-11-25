/**
 * Tests for the settings store endpoint over the shared MSW server, with the
 * recorded Wired and Pleroma fixtures: GET answers `{}` or the stored object,
 * PATCH sends the JSON body and returns the merged object, extra keys pass
 * through, and 422 "too large", 403 and 404/501 map to the typed errors while
 * other failures stay plain ApiErrors. WiredFE's OAuth scopes cover the
 * endpoint's `read` and `write` needs.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getSettingsStore, patchSettingsStore } from './settingsStore';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import pleromaFixture from '../fixtures/settingsStore/pleroma.json';
import wiredFixture from '../fixtures/settingsStore/wired.json';
import { OAUTH_SCOPES } from '../oauth';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const URL = `${ORIGIN}/api/v1/pleroma/settings/wired-fe`;

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

const PATCH = { desktop: { updatedAt: 1790000005000 } };

const FIXTURES = [
  ['Wired', wiredFixture],
  ['Pleroma', pleromaFixture],
] as const;

/** Answers GET and PATCH on the settings URL with {@link status} and {@link body}; returns the requests seen. */
function serve(status: number, body: JsonBodyType): Request[] {
  const seen: Request[] = [];
  const answer = ({ request }: { request: Request }): Response => {
    seen.push(request.clone());
    return HttpResponse.json(body, { status });
  };
  server.use(http.get(URL, answer), http.patch(URL, answer));
  return seen;
}

/** The failure of {@link result}, failing the test when it succeeded. */
function failureOf<E>(result: Result<unknown, E>): E {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe.each(FIXTURES)('%s settings store', (_backend, fixture) => {
  it('gets an empty object', async () => {
    serve(200, fixture.empty);

    await expect(getSettingsStore(SESSION)).resolves.toStrictEqual(ok({}));
  });

  it('gets the stored object, extra keys included', async () => {
    const seen = serve(200, fixture.withData);

    await expect(getSettingsStore(SESSION)).resolves.toStrictEqual(ok(fixture.withData));
    expect(seen.map((request) => request.method)).toStrictEqual(['GET']);
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer secret');
  });

  it('patches with a JSON body and returns the merged object', async () => {
    const seen = serve(200, fixture.patchEcho);

    await expect(patchSettingsStore(SESSION, PATCH)).resolves.toStrictEqual(ok(fixture.patchEcho));
    expect(seen.map((request) => request.method)).toStrictEqual(['PATCH']);
    expect(seen[0]?.headers.get('Content-Type')).toBe('application/json');
    await expect(seen[0]?.text()).resolves.toBe(JSON.stringify(PATCH));
  });

  it.each([
    ['get', getSettingsStore],
    ['patch', async (session: ApiSession) => await patchSettingsStore(session, PATCH)],
  ])('maps 422 too large to tooLarge on %s', async (_name, call) => {
    serve(422, fixture.tooLarge);

    expect(failureOf(await call(SESSION))).toStrictEqual({ kind: 'tooLarge' });
  });

  it('maps 403 to forbidden', async () => {
    serve(403, fixture.forbidden);

    expect(failureOf(await patchSettingsStore(SESSION, PATCH))).toStrictEqual({
      kind: 'forbidden',
    });
  });

  it.each([404, 501])('maps %d to unsupported', async (status) => {
    serve(status, fixture.notFound);

    expect(failureOf(await getSettingsStore(SESSION))).toStrictEqual({ kind: 'unsupported' });
  });
});

describe('settings store errors', () => {
  it('keeps another 422 as the plain http error', async () => {
    serve(422, { error: 'Invalid body' });

    expect(failureOf(await patchSettingsStore(SESSION, PATCH))).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'Invalid body',
    });
  });

  it('keeps a server error as the plain http error', async () => {
    serve(500, { error: 'Boom' });

    expect(failureOf(await getSettingsStore(SESSION))).toStrictEqual({
      kind: 'http',
      status: 500,
      message: 'Boom',
    });
  });

  it('reports an answer that is not an object as a parse error', async () => {
    serve(200, []);

    expect(failureOf(await getSettingsStore(SESSION)).kind).toBe('parse');
  });

  it('reports a dropped connection as a network error', async () => {
    server.use(http.get(URL, () => HttpResponse.error()));

    expect(failureOf(await getSettingsStore(SESSION)).kind).toBe('network');
  });
});

describe('OAuth scopes', () => {
  it('include read and write, which the settings store needs', () => {
    const scopes = OAUTH_SCOPES.split(' ');

    expect(scopes).toContain('read');
    expect(scopes).toContain('write');
  });
});
