// @vitest-environment node
/**
 * Tests for describing an attachment: the text goes as JSON to a PUT on the
 * attachment's own path, with the session's token, and the answer is the
 * attachment as the instance now has it.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { updateMedia } from './media';
import { ok } from '../../lib/result';
import { server } from '../../test/server';
import type { MediaAttachment } from '../schemas/mediaAttachment';

const ORIGIN = 'https://wired.example';

/** The attachment as the instance answers once it has the description. */
const DESCRIBED: MediaAttachment = {
  id: 'a/b',
  type: 'image',
  url: `${ORIGIN}/media/12.png`,
  preview_url: null,
  remote_url: null,
  description: 'A pixel',
  blurhash: null,
};

describe(updateMedia, () => {
  it('puts the description as json to the attachment', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put(`${ORIGIN}/api/v1/media/a%2Fb`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        bodies.push(await request.json());

        return HttpResponse.json(DESCRIBED);
      }),
    );

    const result = await updateMedia({ origin: ORIGIN, token: 'secret' }, 'a/b', 'A pixel');

    expect(result).toStrictEqual(ok(DESCRIBED));
    expect(bodies).toStrictEqual([{ description: 'A pixel' }]);
  });
});
