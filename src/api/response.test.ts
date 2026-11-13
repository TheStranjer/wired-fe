/**
 * Tests for the response handling of apiRequest: the status and body mapping
 * as direct unit tests of toApiResponse on hand-built Response objects, and
 * the failure mappings again end-to-end through apiRequest over the shared
 * MSW server.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { ApiError } from './errors';
import { apiRequest } from './http';
import { type ApiResponse, toApiResponse } from './response';
import { type Result, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const schema = v.object({ name: v.string() });
const nullSchema = v.null();
const profileSchema = v.object({ id: v.string(), name: v.string() });

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected apiRequest to fail');
  }
  return result.error;
}

/** The message of a parse failure, or null when the result is not one. */
function parseFailureMessage(result: Result<unknown, ApiError>): string | null {
  if (result.ok || result.error.kind !== 'parse') {
    return null;
  }
  return result.error.message;
}

describe(toApiResponse, () => {
  it('returns validated data and the Link header for a JSON success body', async () => {
    const link = '<https://wired.example/x?min_id=2>; rel="prev"';
    const response = new Response(JSON.stringify({ name: 'Lain' }), { headers: { Link: link } });

    const result = await toApiResponse(response, schema);

    const expected: ApiResponse<{ name: string }> = { data: { name: 'Lain' }, link };

    expect(result).toStrictEqual(ok(expected));
  });

  it('validates a 204 as null', async () => {
    const result = await toApiResponse(new Response(null, { status: 204 }), nullSchema);

    expect(result).toStrictEqual(ok({ data: null, link: null }));
  });

  it('validates an empty 200 body as null', async () => {
    const result = await toApiResponse(new Response('', { status: 200 }), nullSchema);

    expect(result).toStrictEqual(ok({ data: null, link: null }));
  });

  it('reports an unparseable 200 body as an Invalid JSON parse error', async () => {
    const result = await toApiResponse(new Response('<not json>', { status: 200 }), schema);

    expect(result).toStrictEqual({ ok: false, error: { kind: 'parse', message: 'Invalid JSON' } });
  });

  it('reports a schema mismatch with the dotted field path', async () => {
    const response = new Response(JSON.stringify({ name: 42 }), { status: 200 });

    const result = await toApiResponse(response, schema);

    expect(parseFailureMessage(result)).toMatch(/^name: /u);
  });

  it('reports a pathless schema failure against (root)', async () => {
    const result = await toApiResponse(new Response('42', { status: 200 }), schema);

    expect(parseFailureMessage(result)).toMatch(/^\(root\): /u);
  });

  it('maps 429 with a valid reset header to the parsed date', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'X-RateLimit-Reset': '2026-11-13T12:00:00.000Z' },
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'rate-limited', resetAt: new Date('2026-11-13T12:00:00.000Z') },
    });
  });

  it('maps 429 with an unparseable reset header to a null date', async () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'X-RateLimit-Reset': 'in a while' },
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual({ ok: false, error: { kind: 'rate-limited', resetAt: null } });
  });

  it('takes the http message from a JSON error string', async () => {
    const response = new Response(JSON.stringify({ error: 'Record not found' }), { status: 404 });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 404, message: 'Record not found' },
    });
  });

  it('falls back to the status text when the JSON error is not a string', async () => {
    const response = new Response(JSON.stringify({ error: ['bad'] }), {
      status: 422,
      statusText: 'Unprocessable Entity',
    });

    const result = await toApiResponse(response, schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 422, message: 'Unprocessable Entity' },
    });
  });

  it('falls back to Request failed when there is no status text either', async () => {
    const result = await toApiResponse(new Response('nope', { status: 500 }), schema);

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 500, message: 'Request failed' },
    });
  });
});

/** The same mappings again through `apiRequest`, over the intercepted network. */
describe(apiRequest, () => {
  it('maps a 404 to the remote error message', async () => {
    server.use(
      http.get(`${ORIGIN}/unknown`, () =>
        HttpResponse.json({ error: 'Record not found' }, { status: 404 }),
      ),
    );

    const result = await apiRequest({ origin: ORIGIN, path: '/unknown', schema: profileSchema });

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });

  it('maps a 500 with an HTML body to the status text', async () => {
    server.use(
      http.get(`${ORIGIN}/boom`, () =>
        HttpResponse.text('<html>oops</html>', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      ),
    );

    const result = await apiRequest({ origin: ORIGIN, path: '/boom', schema: profileSchema });

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 500,
      message: 'Internal Server Error',
    });
  });

  it('maps 429 to rate-limited with the reset date', async () => {
    const reset = '2026-11-13T12:00:00.000Z';
    server.use(
      http.get(
        `${ORIGIN}/slow`,
        () => new HttpResponse(null, { status: 429, headers: { 'X-RateLimit-Reset': reset } }),
      ),
    );

    const result = await apiRequest({ origin: ORIGIN, path: '/slow', schema: profileSchema });

    expect(failureOf(result)).toStrictEqual({ kind: 'rate-limited', resetAt: new Date(reset) });
  });

  it('maps 429 without a reset header to a null date', async () => {
    server.use(http.get(`${ORIGIN}/slow`, () => new HttpResponse(null, { status: 429 })));

    const result = await apiRequest({ origin: ORIGIN, path: '/slow', schema: profileSchema });

    expect(failureOf(result)).toStrictEqual({ kind: 'rate-limited', resetAt: null });
  });

  it('maps a malformed JSON success body to a parse error', async () => {
    server.use(http.get(`${ORIGIN}/broken`, () => new HttpResponse('{oops', { status: 200 })));

    const result = await apiRequest({ origin: ORIGIN, path: '/broken', schema: profileSchema });

    expect(parseFailureMessage(result)).toBe('Invalid JSON');
  });

  it('maps a schema mismatch to the field path', async () => {
    server.use(http.get(`${ORIGIN}/wrong`, () => HttpResponse.json({ id: 42, name: 'Lain' })));

    const result = await apiRequest({ origin: ORIGIN, path: '/wrong', schema: profileSchema });

    expect(parseFailureMessage(result)).toMatch(/^id: /u);
  });
});
