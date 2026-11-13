/**
 * Behaviour tests for `apiRequest` over the shared MSW server: request
 * building (headers, query, bodies), the success path, and the transport
 * failures. The status and body mappings live in ./response.test.ts.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { ApiError } from './errors';
import { type ApiResponse, type QueryValue, apiRequest } from './http';
import { type Result, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const profileSchema = v.object({ id: v.string(), name: v.string() });

const PROFILE = { id: '1', name: 'Lain' };

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected apiRequest to fail');
  }
  return result.error;
}

describe(apiRequest, () => {
  it('sends the token and Accept, returns validated data and Link', async () => {
    const path = '/api/v1/accounts/verify_credentials';
    const link = '<https://wired.example/next>; rel="next"';
    server.use(
      http.get(`${ORIGIN}${path}`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(request.headers.get('Accept')).toBe('application/json');

        return HttpResponse.json(PROFILE, { headers: { Link: link } });
      }),
    );

    const result = await apiRequest({
      origin: ORIGIN,
      path,
      token: 'secret',
      schema: profileSchema,
    });

    const expected: ApiResponse<typeof PROFILE> = { data: PROFILE, link };

    expect(result).toStrictEqual(ok(expected));
  });

  it('sends an extra header next to the built-ins', async () => {
    server.use(
      http.post(`${ORIGIN}/statuses`, ({ request }) => {
        expect(request.headers.get('Idempotency-Key')).toBe('key-1');
        expect(request.headers.get('Accept')).toBe('application/json');

        return HttpResponse.json(PROFILE);
      }),
    );

    const result = await apiRequest({
      origin: ORIGIN,
      path: '/statuses',
      method: 'POST',
      headers: { 'Idempotency-Key': 'key-1' },
      schema: profileSchema,
    });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('lets the built-in Authorization overwrite a provided one', async () => {
    server.use(
      http.get(`${ORIGIN}/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(PROFILE);
      }),
    );

    const result = await apiRequest({
      origin: ORIGIN,
      path: '/me',
      token: 'secret',
      headers: { Authorization: 'Bearer forged' },
      schema: profileSchema,
    });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('builds Mastodon-style query strings', async () => {
    server.use(
      http.get(`${ORIGIN}/search`, ({ request }) => {
        const params = new URL(request.url).searchParams;

        expect(params.get('limit')).toBe('20');
        expect(params.get('only_media')).toBe('true');
        expect(params.getAll('tag[]')).toStrictEqual(['lain', 'serial experiments']);
        expect(params.has('missing')).toBe(false);

        return HttpResponse.json([]);
      }),
    );

    const query: Record<string, QueryValue> = {
      limit: 20,
      only_media: true,
      tag: ['lain', 'serial experiments'],
      missing: undefined,
    };
    const result = await apiRequest({
      origin: ORIGIN,
      path: '/search',
      query,
      schema: v.array(v.string()),
    });

    expect(result).toStrictEqual(ok({ data: [], link: null }));
  });

  it('posts a JSON body with the JSON content type', async () => {
    server.use(
      http.post(`${ORIGIN}/statuses`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({ status: 'hello world' });

        return HttpResponse.json(PROFILE);
      }),
    );

    const result = await apiRequest({
      origin: ORIGIN,
      path: '/statuses',
      method: 'POST',
      json: { status: 'hello world' },
      schema: profileSchema,
    });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('posts form data as multipart with the field intact', async () => {
    server.use(
      http.post(`${ORIGIN}/media`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data/u);

        const form = await request.formData();

        expect(form.get('description')).toBe('a cat');

        return HttpResponse.json(PROFILE);
      }),
    );

    const form = new FormData();
    form.set('description', 'a cat');
    const result = await apiRequest({
      origin: ORIGIN,
      path: '/media',
      method: 'POST',
      form,
      schema: profileSchema,
    });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('validates a 204 against a schema that accepts null', async () => {
    server.use(http.delete(`${ORIGIN}/statuses/1`, () => new HttpResponse(null, { status: 204 })));

    const result = await apiRequest({
      origin: ORIGIN,
      path: '/statuses/1',
      method: 'DELETE',
      schema: v.null(),
    });

    expect(result).toStrictEqual(ok({ data: null, link: null }));
  });

  it('maps a network failure to a network error', async () => {
    server.use(http.get(`${ORIGIN}/down`, () => HttpResponse.error()));

    const result = await apiRequest({ origin: ORIGIN, path: '/down', schema: profileSchema });

    expect(failureOf(result).kind).toBe('network');
  });

  it('maps an already-aborted signal to aborted', async () => {
    server.use(http.get(`${ORIGIN}/never`, () => HttpResponse.json(PROFILE)));

    const controller = new AbortController();
    controller.abort();
    const result = await apiRequest({
      origin: ORIGIN,
      path: '/never',
      signal: controller.signal,
      schema: profileSchema,
    });

    expect(failureOf(result)).toStrictEqual({ kind: 'aborted' });
  });

  it('stringifies a network failure that is not an Error', async () => {
    server.use(http.get(`${ORIGIN}/weird`, () => HttpResponse.json(PROFILE)));

    const controller = new AbortController();
    controller.abort('boom');
    const result = await apiRequest({
      origin: ORIGIN,
      path: '/weird',
      signal: controller.signal,
      schema: profileSchema,
    });

    expect(failureOf(result)).toStrictEqual({ kind: 'network', message: 'boom' });
  });
});
