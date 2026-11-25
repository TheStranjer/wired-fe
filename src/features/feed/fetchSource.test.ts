/**
 * Tests for the feed sources over the shared MSW server: each source asks the
 * endpoint the matching window uses — mentions narrowed by type, local with
 * its flag, tags by name, direct messages as the conversations' last words —
 * and answers feed items tagged with the source and its account; a page
 * request's cursor and limit go out, the Link header comes back as the next
 * cursor, and a failing endpoint's error passes through.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type Ask, fetchSourcePage } from './fetchSource';
import type { FeedSource, FeedSourceRef } from '../../state/feeds';
import { ALICE, wireConversation } from '../../test/dmWindow';
import { notification, status } from '../../test/fixtures';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';
const KEY = `${ORIGIN}#1`;

/** The request every test makes unless it says otherwise. */
const ASK: Ask = {
  session: { origin: ORIGIN, token: 'never-logged' },
  page: { limit: 40 },
  signal: new AbortController().signal,
};

/** The source {@link source} of the one account. */
function ref(source: FeedSource): FeedSourceRef {
  return { accountKey: KEY, source };
}

/** Answer GET {@link path} with {@link body}, recording each request's URL. */
function serve(path: string, body: JsonBodyType, headers: Record<string, string> = {}): URL[] {
  const seen: URL[] = [];
  server.use(
    http.get(`${ORIGIN}${path}`, ({ request }) => {
      seen.push(new URL(request.url));

      return HttpResponse.json(body, { headers });
    }),
  );
  return seen;
}

/** The items of an answer that must have succeeded. */
async function itemsOf(source: FeedSource, ask: Ask = ASK): Promise<readonly unknown[]> {
  const result = await fetchSourcePage(ref(source), ask);

  if (!result.ok) {
    throw new Error(`the ${source} source failed`);
  }
  return result.value.items;
}

describe(fetchSourcePage, () => {
  it.each([
    ['home', '/api/v1/timelines/home'],
    ['local', '/api/v1/timelines/public'],
    ['federated', '/api/v1/timelines/public'],
    ['tag:lain', '/api/v1/timelines/tag/lain'],
  ] as const)('reads %s as posts fetched by its account', async (source, path) => {
    const seen = serve(path, [status('2'), status('1')]);

    const items = await itemsOf(source);

    expect(items).toMatchObject([
      { kind: 'post', accountKey: KEY, source: ref(source), status: { id: '2' } },
      { kind: 'post', accountKey: KEY, status: { id: '1' } },
    ]);
    expect(seen.map((url) => url.searchParams.get('limit'))).toStrictEqual(['40']);
  });

  it('asks the public timeline for local posts only for local', async () => {
    const seen = serve('/api/v1/timelines/public', []);

    await itemsOf('local');
    await itemsOf('federated');

    expect(seen.map((url) => url.searchParams.get('local'))).toStrictEqual(['true', null]);
  });

  it('reads mentions as the notifications of that type', async () => {
    const seen = serve('/api/v1/notifications', [notification('7', status('5'))]);

    const items = await itemsOf('mentions');

    expect(items).toMatchObject([{ kind: 'notification', accountKey: KEY }]);
    expect(seen.map((url) => url.searchParams.getAll('types[]'))).toStrictEqual([['mention']]);
  });

  it('reads notifications unfiltered', async () => {
    const seen = serve('/api/v1/notifications', [notification('9', null)]);

    const items = await itemsOf('notifications');

    expect(items).toMatchObject([{ kind: 'notification', source: ref('notifications') }]);
    expect(seen.map((url) => url.searchParams.getAll('types[]'))).toStrictEqual([[]]);
  });

  it('reads dms as the last word of each conversation, leaving out empty ones', async () => {
    serve('/api/v1/conversations', [
      wireConversation('c1', [ALICE], status('8')),
      wireConversation('c2', [ALICE], null),
    ]);

    const items = await itemsOf('dms');

    expect(items).toMatchObject([{ kind: 'post', accountKey: KEY, status: { id: '8' } }]);
  });

  it('sends the cursor and answers the next one from the Link header', async () => {
    const seen = serve('/api/v1/timelines/home', [status('1')], {
      Link: `<${ORIGIN}/api/v1/timelines/home?max_id=1>; rel="next"`,
    });
    const ask: Ask = { ...ASK, page: { cursor: { max_id: '5' }, limit: 40 } };

    const result = await fetchSourcePage(ref('home'), ask);

    expect(seen.map((url) => url.searchParams.get('max_id'))).toStrictEqual(['5']);
    expect(result.ok && result.value.links.next).toStrictEqual({ max_id: '1' });
  });

  it('passes an endpoint failure through', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json({ error: 'Boom' }, { status: 500 }),
      ),
    );

    const result = await fetchSourcePage(ref('home'), ASK);

    expect(result).toMatchObject({ ok: false, error: { kind: 'http', status: 500 } });
  });
});
