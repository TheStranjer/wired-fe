/**
 * Tests for the timeline endpoints over the shared MSW server, whose handlers
 * inspect the request URL: the home request carries its page cursor and limit
 * and its `Link` header comes back as `links.next`; `local: true` adds public's
 * `local` parameter and `local: false` omits it; the tag endpoint drops a
 * leading `#`, percent-encodes the name and keeps the page query; and a
 * cancelled request is the aborted error (malformed statuses: see
 * timelinesPartial.test.ts).
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { homeTimeline, publicTimeline, tagTimeline } from './timelines';
import { err, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { Status } from '../schemas/status';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The minimal status one of the three backends sends. */
const LAIN_WIRE = {
  id: '1',
  uri: 'https://wired.example/posts/1',
  created_at: '2026-11-12T18:00:00.000Z',
  account: {
    id: '109',
    username: 'lain',
    acct: 'lain@wired.example',
    display_name: 'Lain Iwakura',
    created_at: '2024-03-01T00:00:00.000Z',
    note: '<p>Close the world. Open the nExt.</p>',
    url: 'https://wired.example/users/lain',
    avatar: 'https://wired.example/avi.png',
    header: 'https://wired.example/banner.png',
    followers_count: 42,
    following_count: 17,
    statuses_count: 12,
  },
  content: '<p>Good morning.</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 1,
  favourites_count: 7,
};

/** What StatusSchema makes of {@link LAIN_WIRE}: every default filled in. */
const LAIN: Status = {
  id: '1',
  uri: 'https://wired.example/posts/1',
  url: null,
  created_at: '2026-11-12T18:00:00.000Z',
  edited_at: null,
  account: {
    id: '109',
    username: 'lain',
    acct: 'lain@wired.example',
    fqn: null,
    display_name: 'Lain Iwakura',
    locked: false,
    bot: false,
    group: false,
    discoverable: null,
    created_at: '2024-03-01T00:00:00.000Z',
    note: '<p>Close the world. Open the nExt.</p>',
    url: 'https://wired.example/users/lain',
    uri: null,
    avatar: 'https://wired.example/avi.png',
    avatar_static: 'https://wired.example/avi.png',
    header: 'https://wired.example/banner.png',
    header_static: 'https://wired.example/banner.png',
    followers_count: 42,
    following_count: 17,
    statuses_count: 12,
    last_status_at: null,
    emojis: [],
    fields: [],
    moved: null,
    pleroma: null,
  },
  content: '<p>Good morning.</p>',
  spoiler_text: '',
  sensitive: false,
  visibility: 'public',
  language: null,
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  reblog: null,
  quote: null,
  media_attachments: [],
  mentions: [],
  tags: [],
  emojis: [],
  poll: null,
  replies_count: 0,
  reblogs_count: 1,
  favourites_count: 7,
  favourited: false,
  reblogged: false,
  bookmarked: false,
  pinned: false,
  muted: false,
  emoji_reactions: [],
  local_only: false,
  conversation_id: null,
};

/** The empty page an answer without a `Link` header wraps into. */
const NO_LINKS = { items: [], links: { next: null, prev: null } };

describe(homeTimeline, () => {
  it('sends the cursor and limit and returns the page with its next link', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.searchParams.get('max_id')).toBe('5');
        expect(url.searchParams.get('limit')).toBe('20');

        return HttpResponse.json([LAIN_WIRE], {
          headers: {
            Link: '<https://wired.example/api/v1/timelines/home?max_id=0>; rel="next"',
          },
        });
      }),
    );

    const result = await homeTimeline(SESSION, { cursor: { max_id: '5' }, limit: 20 });

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [LAIN], links: { next: { max_id: '0' }, prev: null } },
    });
  });

  it('asks for the first page with no query when given no page', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');

        return HttpResponse.json([LAIN_WIRE]);
      }),
    );

    const result = await homeTimeline(SESSION);

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [LAIN], links: { next: null, prev: null } },
    });
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => {
        return HttpResponse.json([]);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await homeTimeline(SESSION, undefined, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });
});

describe(publicTimeline, () => {
  it('asks for the local timeline with the page query', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/public`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get('local')).toBe('true');
        expect(url.searchParams.get('limit')).toBe('10');

        return HttpResponse.json([]);
      }),
    );

    const result = await publicTimeline(SESSION, { local: true, page: { limit: 10 } });

    expect(result).toStrictEqual(ok(NO_LINKS));
  });

  it('omits the local parameter for the federated timeline', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/public`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.has('local')).toBe(false);

        return HttpResponse.json([LAIN_WIRE]);
      }),
    );

    const result = await publicTimeline(SESSION, { local: false });

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [LAIN], links: { next: null, prev: null } },
    });
  });
});

describe(tagTimeline, () => {
  it('drops the leading hash and gets the tag page', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/tag/Lain`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/timelines/tag/Lain');
        expect(url.searchParams.get('min_id')).toBe('3');

        return HttpResponse.json([LAIN_WIRE]);
      }),
    );

    const result = await tagTimeline(SESSION, '#Lain', { cursor: { min_id: '3' } });

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [LAIN], links: { next: null, prev: null } },
    });
  });

  it('percent-encodes a tag with a space', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/tag/*`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/timelines/tag/close%20world');

        return HttpResponse.json([]);
      }),
    );

    const result = await tagTimeline(SESSION, 'close world');

    expect(result).toStrictEqual(ok(NO_LINKS));
  });
});
