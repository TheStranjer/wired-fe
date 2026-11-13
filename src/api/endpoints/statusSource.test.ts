/**
 * The status source endpoint over the shared MSW server: the GET of the
 * encoded source path returns the author's plain text, Wired's extra
 * `content_type` key dropped and `spoiler_text` defaulting to the empty string
 * when a backend leaves it out; a source that is not the caller's is the 403
 * Wired answers, and a body without text is a parse error.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getStatusSource } from './statusSource';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The source of Wired's own post, with the key only Wired sends. */
const WIRED_WIRE = {
  id: '1',
  text: 'Close the world. Open the nExt.',
  spoiler_text: 'nExt',
  content_type: 'text/plain',
};

/** What the endpoint returns for it: Wired's `content_type` dropped. */
const SOURCE = { id: '1', text: 'Close the world. Open the nExt.', spoiler_text: 'nExt' };

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(getStatusSource, () => {
  it('GETs the source path and returns the text with its warning', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/source`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/statuses/1/source');
        expect(url.search).toBe('');

        return HttpResponse.json(WIRED_WIRE);
      }),
    );

    const result = await getStatusSource(SESSION, '1');

    expect(result).toStrictEqual(ok(SOURCE));
  });

  it('defaults a missing spoiler_text to the empty string', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/source`, () => {
        return HttpResponse.json({ id: '1', text: 'Good morning.' });
      }),
    );

    const result = await getStatusSource(SESSION, '1');

    expect(result).toStrictEqual(ok({ id: '1', text: 'Good morning.', spoiler_text: '' }));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/:id/source`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/statuses/a%2Fb/source');

        return HttpResponse.json({ ...WIRED_WIRE, id: 'a/b' });
      }),
    );

    const result = await getStatusSource(SESSION, 'a/b');

    expect(result).toStrictEqual(ok({ ...SOURCE, id: 'a/b' }));
  });

  it('reports the post of another account as the 403 its server answers', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/source`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 403 });
      }),
    );

    const result = await getStatusSource(SESSION, '1');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 403,
      message: 'Record not found',
    });
  });

  it('reports a body without text as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/source`, () => {
        return HttpResponse.json({ id: '1' });
      }),
    );

    const result = await getStatusSource(SESSION, '1');

    expect(failureOf(result).kind).toBe('parse');
  });
});
