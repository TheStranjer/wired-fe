/**
 * Tests for how the timeline endpoints treat a malformed page: one status
 * that fails its schema is dropped while the rest of the page and its `Link`
 * cursors survive, and a body that is not an array is still a parse error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { homeTimeline } from './timelines';
import { server } from '../../test/server';
import { StatusSchema } from '../schemas/status';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The smallest status every backend sends, with {@link id} and any extras. */
function wire(id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    uri: `${ORIGIN}/posts/${id}`,
    created_at: '2026-11-12T18:00:00.000Z',
    account: {
      id: '109',
      username: 'lain',
      acct: 'lain@wired.example',
      display_name: 'Lain Iwakura',
      created_at: '2024-03-01T00:00:00.000Z',
      note: '<p>Close the world.</p>',
      url: `${ORIGIN}/users/lain`,
      avatar: `${ORIGIN}/avi.png`,
      header: `${ORIGIN}/banner.png`,
      followers_count: 42,
      following_count: 17,
      statuses_count: 12,
    },
    content: '<p>Good morning.</p>',
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 1,
    favourites_count: 7,
    ...extras,
  };
}

describe('timeline pages with a malformed status', () => {
  it('drops the one bad status and still parses the Link cursors', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => {
        return HttpResponse.json([wire('1'), wire('2', { replies_count: -1 }), wire('3')], {
          headers: {
            Link: `<${ORIGIN}/api/v1/timelines/home?max_id=0>; rel="next"`,
          },
        });
      }),
    );

    const result = await homeTimeline(SESSION);

    expect(result).toStrictEqual({
      ok: true,
      value: {
        items: [v.parse(StatusSchema, wire('1')), v.parse(StatusSchema, wire('3'))],
        links: { next: { max_id: '0' }, prev: null },
      },
    });
  });

  it('reports a body that is not an array as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => {
        return HttpResponse.json({ error: 'nope' });
      }),
    );

    const result = await homeTimeline(SESSION);

    expect(result.ok ? undefined : result.error.kind).toBe('parse');
  });
});
