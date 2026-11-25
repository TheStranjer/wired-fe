/**
 * Tests for the media window's load (WFE-263): a served post is `ready`, a
 * refused one `failed` with its description, and a load cancelled with its
 * window is `loading` again. MSW stands in for the instance.
 */
import { describe, expect, it } from 'vitest';

import { loadMediaStatus } from './useMediaStatus';
import { attachment, mediaPost, MEDIA_ORIGIN, serveMediaStatus } from '../../test/mediaWindow';
import { withSession } from '../../test/withToken';

const SESSION = withSession({ origin: MEDIA_ORIGIN, token: 'never-logged' });

describe(loadMediaStatus, () => {
  it('is ready with the post the instance serves', async () => {
    const post = mediaPost([attachment('m1')]);
    serveMediaStatus(post);

    const load = await loadMediaStatus(SESSION, 'p', new AbortController().signal);

    expect(load).toMatchObject({ kind: 'ready', status: { id: 'p' } });
  });

  it('fails with the description of the refusal', async () => {
    serveMediaStatus(null);

    await expect(
      loadMediaStatus(SESSION, 'p', new AbortController().signal),
    ).resolves.toStrictEqual({ kind: 'failed', text: 'HTTP 404: Record not found' });
  });

  it('is still loading once its window has closed', async () => {
    serveMediaStatus(mediaPost([attachment('m1')]));
    const controller = new AbortController();
    controller.abort();

    await expect(loadMediaStatus(SESSION, 'p', controller.signal)).resolves.toStrictEqual({
      kind: 'loading',
    });
  });
});
