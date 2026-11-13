/**
 * Tests for NodeInfo discovery over the shared MSW server: the 2.1 link is
 * preferred and its path and search requested on the instance origin, the 2.0
 * link is the fallback, a list without a 2.x entry or an href on another
 * origin becomes the stated parse error, and any apiRequest failure — the 404
 * of the well-known path or a failed document call — propagates unchanged.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { ApiError } from './errors';
import { NODEINFO_REL_20, NODEINFO_REL_21, fetchNodeInfo } from './nodeinfo';
import type { NodeInfo } from './schemas/nodeinfo';
import { type Result, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const WELL_KNOWN = `${ORIGIN}/.well-known/nodeinfo`;

/** The wire document served behind the 2.1 link of these tests. */
const WIRE_21 = {
  version: '2.1',
  software: { name: 'Wired', version: '0.4.0' },
  metadata: { features: ['pleroma_api', 'mastodon_api'] },
};

/** The {@link WIRE_21} document as the schema normalizes it. */
const DOC_21: NodeInfo = {
  version: '2.1',
  software: { name: 'wired', version: '0.4.0' },
  openRegistrations: null,
  features: ['pleroma_api', 'mastodon_api'],
  nodeName: null,
};

/** Serves {@link links} on the well-known discovery path. */
function serveLinks(links: readonly { rel: string; href: string }[]): void {
  server.use(http.get(WELL_KNOWN, () => HttpResponse.json({ links })));
}

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected fetchNodeInfo to fail');
  }
  return result.error;
}

describe(fetchNodeInfo, () => {
  it('prefers the 2.1 link and returns its normalized document', async () => {
    serveLinks([
      { rel: NODEINFO_REL_20, href: `${ORIGIN}/nodeinfo/2.0` },
      { rel: NODEINFO_REL_21, href: `${ORIGIN}/nodeinfo/2.1` },
    ]);
    server.use(
      http.get(`${ORIGIN}/nodeinfo/2.0`, () =>
        HttpResponse.json({ version: '2.0', software: { name: 'wrong', version: '0' } }),
      ),
      http.get(`${ORIGIN}/nodeinfo/2.1`, () => HttpResponse.json(WIRE_21)),
    );
    const result = await fetchNodeInfo(ORIGIN);

    expect(result).toStrictEqual(ok(DOC_21));
  });

  it('falls back to the 2.0 link and carries the signal', async () => {
    serveLinks([
      { rel: 'http://nodeinfo.diaspora.software/ns/schema/1.0', href: `${ORIGIN}/nodeinfo/1.0` },
      { rel: NODEINFO_REL_20, href: `${ORIGIN}/nodeinfo/2.0` },
    ]);
    server.use(
      http.get(`${ORIGIN}/nodeinfo/2.0`, () =>
        HttpResponse.json({
          version: '2.0',
          software: { name: 'Mastodon', version: '4.3.0' },
          openRegistrations: false,
        }),
      ),
    );

    const result = await fetchNodeInfo(ORIGIN, new AbortController().signal);

    expect(result).toStrictEqual(
      ok({
        version: '2.0',
        software: { name: 'mastodon', version: '4.3.0' },
        openRegistrations: false,
        features: [],
        nodeName: null,
      }),
    );
  });

  it('requests the href path together with its search', async () => {
    serveLinks([{ rel: NODEINFO_REL_21, href: `${ORIGIN}/nodeinfo/2.1?profile=main` }]);
    server.use(
      http.get(`${ORIGIN}/nodeinfo/2.1`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('profile')).toBe('main');

        return HttpResponse.json(WIRE_21);
      }),
    );

    const result = await fetchNodeInfo(ORIGIN);

    expect(result).toStrictEqual(ok(DOC_21));
  });

  it('reports a link list without any 2.x entry as a parse error', async () => {
    serveLinks([
      { rel: 'https://example.net/custom', href: `${ORIGIN}/nodeinfo/custom` },
      { rel: 'http://nodeinfo.diaspora.software/ns/schema/1.0', href: `${ORIGIN}/nodeinfo/1.0` },
    ]);

    const result = await fetchNodeInfo(ORIGIN);

    expect(failureOf(result)).toStrictEqual({ kind: 'parse', message: 'No NodeInfo 2.x link' });
  });

  it('refuses an href pointing to another origin', async () => {
    serveLinks([
      { rel: NODEINFO_REL_21, href: 'https://evil.example/nodeinfo/2.1' },
      { rel: NODEINFO_REL_20, href: `${ORIGIN}/nodeinfo/2.0` },
    ]);

    const result = await fetchNodeInfo(ORIGIN);

    expect(failureOf(result)).toStrictEqual({
      kind: 'parse',
      message: 'NodeInfo link points to another origin',
    });
  });

  it('refuses an href that is not an absolute URL', async () => {
    serveLinks([{ rel: NODEINFO_REL_21, href: '/nodeinfo/2.1' }]);

    const result = await fetchNodeInfo(ORIGIN);

    expect(failureOf(result)).toStrictEqual({
      kind: 'parse',
      message: 'NodeInfo link points to another origin',
    });
  });

  it('propagates a 404 on the well-known path unchanged', async () => {
    server.use(
      http.get(WELL_KNOWN, () => HttpResponse.json({ error: 'Not Found' }, { status: 404 })),
    );

    const result = await fetchNodeInfo(ORIGIN);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 404, message: 'Not Found' });
  });

  it('propagates a failed document request unchanged', async () => {
    serveLinks([{ rel: NODEINFO_REL_21, href: `${ORIGIN}/nodeinfo/2.1` }]);
    server.use(
      http.get(`${ORIGIN}/nodeinfo/2.1`, () =>
        HttpResponse.json({ error: 'Server Error' }, { status: 500 }),
      ),
    );

    const result = await fetchNodeInfo(ORIGIN);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 500, message: 'Server Error' });
  });
});
