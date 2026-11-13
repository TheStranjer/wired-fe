/**
 * Tests for the instance document endpoints over the shared MSW server: each
 * GET carries the session's bearer token and answers the summary its schema
 * extracts (decision 7), v2's 404 — the answer of a server with no v2
 * document — becomes ok(null), other failures propagate as their ApiError,
 * and a cancelled request answers the aborted error.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getInstanceV1, getInstanceV2 } from './instance';
import { type Result, err, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import type { InstanceV1 } from '../schemas/instanceV1';
import type { InstanceV2 } from '../schemas/instanceV2';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

const V1_PATH = '/api/v1/instance';

const V2_PATH = '/api/v2/instance';

/** Wired's v1 document: top-level limits and Pleroma-style advertised features. */
const WIRED_V1_WIRE = {
  title: 'wired.example',
  version: '2.7.2 (compatible; Pleroma 2.5.0)',
  description: 'The Wired side of the wire.',
  max_toot_chars: 1_000,
  poll_limits: {
    max_options: 6,
    max_option_chars: 40,
    min_expiration: 60,
    max_expiration: 86_400,
  },
  pleroma: { metadata: { features: ['reactions', 'oauth_api', 'shout'] } },
};

/** What InstanceV1Schema makes of {@link WIRED_V1_WIRE}. */
const WIRED_V1: InstanceV1 = {
  title: 'wired.example',
  version: '2.7.2 (compatible; Pleroma 2.5.0)',
  maxCharacters: 1_000,
  maxMediaAttachments: null,
  pollLimits: {
    maxOptions: 6,
    maxCharactersPerOption: 40,
    minExpiration: 60,
    maxExpiration: 86_400,
  },
  features: ['reactions', 'oauth_api', 'shout'],
};

/** Mastodon's v2 document: everything under configuration, plus api_versions. */
const MASTODON_V2_WIRE = {
  domain: 'mastodon.example',
  title: 'mastodon.example',
  version: '4.3.0',
  api_versions: { mastodon: 2 },
  configuration: {
    statuses: { max_characters: 500, max_media_attachments: 4 },
    polls: {
      max_options: 4,
      max_characters_per_option: 30,
      min_expiration: 300,
      max_expiration: 2_592_000,
    },
  },
};

/** What InstanceV2Schema makes of {@link MASTODON_V2_WIRE}. */
const MASTODON_V2: InstanceV2 = {
  title: 'mastodon.example',
  version: '4.3.0',
  mastodonApiVersion: 2,
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: {
    maxOptions: 4,
    maxCharactersPerOption: 30,
    minExpiration: 300,
    maxExpiration: 2_592_000,
  },
};

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(getInstanceV1, () => {
  it('gets the document and returns the Wired summary', async () => {
    server.use(
      http.get(`${ORIGIN}${V1_PATH}`, ({ request }) => {
        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(WIRED_V1_WIRE);
      }),
    );

    const result = await getInstanceV1(SESSION);

    expect(result).toStrictEqual(ok(WIRED_V1));
  });

  it('reports a refused request as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}${V1_PATH}`, () => {
        return HttpResponse.json({ error: 'Boom' }, { status: 500 });
      }),
    );

    const result = await getInstanceV1(SESSION);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 500, message: 'Boom' });
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}${V1_PATH}`, () => {
        return HttpResponse.json(WIRED_V1_WIRE);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await getInstanceV1(SESSION, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });
});

describe(getInstanceV2, () => {
  it('gets the document and returns its summary', async () => {
    server.use(
      http.get(`${ORIGIN}${V2_PATH}`, ({ request }) => {
        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(MASTODON_V2_WIRE);
      }),
    );

    const result = await getInstanceV2(SESSION);

    expect(result).toStrictEqual(ok(MASTODON_V2));
  });

  it('reads a 404 as a server without a v2 document', async () => {
    server.use(
      http.get(`${ORIGIN}${V2_PATH}`, () => {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }),
    );

    const result = await getInstanceV2(SESSION);

    expect(result).toStrictEqual(ok(null));
  });

  it('passes any other failure through unchanged', async () => {
    server.use(
      http.get(`${ORIGIN}${V2_PATH}`, () => {
        return HttpResponse.json({ error: 'Boom' }, { status: 500 });
      }),
    );

    const result = await getInstanceV2(SESSION);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 500, message: 'Boom' });
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}${V2_PATH}`, () => {
        return HttpResponse.json(MASTODON_V2_WIRE);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await getInstanceV2(SESSION, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });
});
