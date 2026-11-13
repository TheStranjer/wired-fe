/**
 * Tests for the custom emoji list endpoint over the shared MSW server: the
 * GET carries the session's bearer token, the answer is parsed through the
 * shared emoji schema (unknown keys dropped, `static_url` falling back to
 * `url`, picker and category defaults applied), an empty list is fine, and a
 * failure or a cancelled request comes back as the matching ApiError.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { listCustomEmojis } from './customEmojis';
import { type Result, err, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import type { CustomEmoji } from '../schemas/customEmoji';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

const PATH = '/api/v1/custom_emojis';

/** Mastodon's shape: a full entry plus the `custom` key the schema drops. */
const LAIN_WIRE = {
  shortcode: 'lain',
  url: 'https://wired.example/emoji/lain.png',
  static_url: 'https://wired.example/emoji/lain_static.png',
  visible_in_picker: true,
  category: 'people',
  custom: true,
};

/** Pleroma's shape: no static_url, picker or category; `tags` is dropped. */
const PLOP_WIRE = {
  shortcode: 'plop',
  url: 'https://wired.example/emoji/plop.gif',
  tags: ['fun'],
};

/** What the shared schema makes of the two wire shapes. */
const EMOJIS: readonly CustomEmoji[] = [
  {
    shortcode: 'lain',
    url: 'https://wired.example/emoji/lain.png',
    static_url: 'https://wired.example/emoji/lain_static.png',
    visible_in_picker: true,
    category: 'people',
  },
  {
    shortcode: 'plop',
    url: 'https://wired.example/emoji/plop.gif',
    static_url: 'https://wired.example/emoji/plop.gif',
    visible_in_picker: true,
    category: null,
  },
];

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(listCustomEmojis, () => {
  it('gets the list and returns the parsed emojis', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, ({ request }) => {
        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json([LAIN_WIRE, PLOP_WIRE]);
      }),
    );

    const result = await listCustomEmojis(SESSION);

    expect(result).toStrictEqual(ok(EMOJIS));
  });

  it('accepts an instance without custom emojis', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json([]);
      }),
    );

    const result = await listCustomEmojis(SESSION);

    expect(result).toStrictEqual(ok([]));
  });

  it('reports a refused request as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json({ error: 'Boom' }, { status: 500 });
      }),
    );

    const result = await listCustomEmojis(SESSION);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 500, message: 'Boom' });
  });

  it('reports an answer that is not a list as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json({ shortcodes: [] });
      }),
    );

    const result = await listCustomEmojis(SESSION);

    expect(failureOf(result).kind).toBe('parse');
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json([LAIN_WIRE]);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await listCustomEmojis(SESSION, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });
});
