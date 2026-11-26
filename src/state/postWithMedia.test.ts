/**
 * Tests for sending a docked box's draft with its media (WFE-289): the alt
 * text of a described line is put to the instance before the post, the post
 * carries the ids of the ready lines, success empties the box's media, and a
 * refusal at either step is the message to show and leaves the media.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import type { AppState } from './appState';
import { composerMediaOf, uploadingMedia } from './composerMedia';
import type { ComposerMedia, Draft } from './draft';
import { postWithMedia } from './postWithMedia';
import { appReducer } from './reducer';
import { ready as attachmentJson } from '../test/attachmentHarness';
import { DM_WINDOW, ORIGIN, dmState } from '../test/dmWindow';
import { server } from '../test/server';
import { activeWindow } from '../windows/model';

/** A ready line for file {@link name} with media id {@link id}, described as {@link description}. */
function ready(name: string, id: string, description: string): ComposerMedia {
  return { ...uploadingMedia(name, name), status: 'ready', mediaId: id, description };
}

/** What a test needs: the state, the media in it, and what the dispatches did. */
function scene(media: readonly ComposerMedia[]): {
  readonly state: AppState;
  readonly dispatched: unknown[];
  readonly context: Parameters<typeof postWithMedia>[0];
} {
  const state = media.reduce(
    (current, item) => appReducer(current, { type: 'composerMediaAdd', windowId: DM_WINDOW, item }),
    dmState(),
  );
  const dispatched: unknown[] = [];
  const dispatch = (action: unknown): void => {
    dispatched.push(action);
  };
  return { state, dispatched, context: { state, dispatch, now: () => new Date() } };
}

const DRAFT: Draft = { text: 'look', visibility: 'direct' };

describe(postWithMedia, () => {
  it('describes first, posts with the ids, and empties the media', async () => {
    const { state, dispatched, context } = scene([ready('a.png', 'm1', ' a cat ')]);
    const put = vi.fn<(body: unknown) => void>();
    server.use(
      http.put(`${ORIGIN}/api/v1/media/m1`, async ({ request }) => {
        put(await request.json());
        return HttpResponse.json(attachmentJson('m1'));
      }),
    );
    const post = vi.fn<NonNullable<Parameters<typeof postWithMedia>[2]['post']>>(
      async () => await Promise.resolve(null),
    );

    const failure = await postWithMedia(context, activeWindow(state.windows), {
      draft: DRAFT,
      media: composerMediaOf(state, DM_WINDOW),
      post,
    });

    expect(failure).toBeNull();
    expect(put).toHaveBeenCalledWith({ description: 'a cat' });
    expect(post.mock.calls[0]?.[0]).toStrictEqual({ ...DRAFT, mediaIds: ['m1'] });
    expect(dispatched).toStrictEqual([{ type: 'composerMediaClear', windowId: DM_WINDOW }]);
  });

  it('keeps the media and the post back when a description is refused', async () => {
    const { state, dispatched, context } = scene([ready('a.png', 'm1', 'a cat')]);
    server.use(
      http.put(`${ORIGIN}/api/v1/media/m1`, () =>
        HttpResponse.json({ error: 'no' }, { status: 422 }),
      ),
    );
    const post = vi.fn<NonNullable<Parameters<typeof postWithMedia>[2]['post']>>(
      async () => await Promise.resolve(null),
    );

    const failure = await postWithMedia(context, activeWindow(state.windows), {
      draft: DRAFT,
      media: composerMediaOf(state, DM_WINDOW),
      post,
    });

    expect(failure).toContain('no');
    expect(post).not.toHaveBeenCalled();
    expect(dispatched).toStrictEqual([]);
  });

  it('keeps the media when the post fails', async () => {
    const { state, dispatched, context } = scene([ready('a.png', 'm1', '')]);

    const failure = await postWithMedia(context, activeWindow(state.windows), {
      draft: DRAFT,
      media: composerMediaOf(state, DM_WINDOW),
      post: async () => await Promise.resolve('boom'),
    });

    expect(failure).toBe('boom');
    expect(dispatched).toStrictEqual([]);
  });
});
