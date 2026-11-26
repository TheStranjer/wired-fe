/**
 * Tests for the pane composers' media: lines are added, patched, removed and
 * cleared by window, only composer windows hold any, a closed window's lines
 * are forgotten with its draft, a ready attachment gets a thumbnail only when
 * it is a picture, the cap counts every line that did not fail, and the draft
 * carries the ids of the accepted ones.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, initialAppState } from './appState';
import {
  COMMAND_LINE_MEDIA,
  composerMediaOf,
  composerMediaReducer,
  draftWithMedia,
  failedPatch,
  heldCount,
  maxMedia,
  readyPatch,
  uploadingMedia,
} from './composerMedia';
import { composerWindowOpen } from './composerWindow';
import { type AppAction, appReducer } from './reducer';
import type { StoredAccount } from '../accounts/accountStore';
import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import { DEFAULT_MAX_MEDIA_ATTACHMENTS } from '../capabilities/capabilities';
import { STATUS_WINDOW_ID } from '../windows/model';

const ACCOUNT: StoredAccount = {
  key: 'https://wired.example#1',
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** A signed-in session with one composer open, and that composer's window id. */
function withComposer(): readonly [AppState, string] {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: composerWindowOpen(ACCOUNT, signedIn.windows.windows),
  });
  return [opened, opened.windows.activeId];
}

/** Apply {@link actions} in order. */
function run(state: AppState, actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, state);
}

/** An attachment of {@link type} as the instance accepts it. */
function accepted(type: MediaAttachment['type'], preview: string | null): MediaAttachment {
  return {
    id: 'm1',
    type,
    url: 'https://wired.example/media/m1',
    preview_url: preview,
    remote_url: null,
    description: null,
    blurhash: null,
  };
}

describe(composerMediaReducer, () => {
  it('adds lines in order, patches one by key and removes one by key', () => {
    const [state, windowId] = withComposer();

    const added = run(state, [
      { type: 'composerMediaAdd', windowId, item: uploadingMedia('a', 'a.png') },
      { type: 'composerMediaAdd', windowId, item: uploadingMedia('b', 'b.png') },
      { type: 'composerMediaPatch', windowId, key: 'b', patch: { description: 'bee' } },
    ]);
    const removed = appReducer(added, { type: 'composerMediaRemove', windowId, key: 'a' });

    expect(composerMediaOf(added, windowId).map((item) => item.name)).toStrictEqual([
      'a.png',
      'b.png',
    ]);
    expect(composerMediaOf(added, windowId).map((item) => item.description)).toStrictEqual([
      '',
      'bee',
    ]);
    expect(composerMediaOf(removed, windowId).map((item) => item.key)).toStrictEqual(['b']);
  });

  it('ignores a patch for a line that is gone', () => {
    const [state, windowId] = withComposer();
    const added = appReducer(state, {
      type: 'composerMediaAdd',
      windowId,
      item: uploadingMedia('a', 'a.png'),
    });

    const patched = appReducer(added, {
      type: 'composerMediaPatch',
      windowId,
      key: 'gone',
      patch: failedPatch('late'),
    });

    expect(composerMediaOf(patched, windowId)).toStrictEqual(composerMediaOf(added, windowId));
  });

  it('clears a composer’s lines and leaves no entry behind', () => {
    const [state, windowId] = withComposer();
    const added = appReducer(state, {
      type: 'composerMediaAdd',
      windowId,
      item: uploadingMedia('a', 'a.png'),
    });

    const cleared = appReducer(added, { type: 'composerMediaClear', windowId });

    expect(composerMediaOf(cleared, windowId)).toStrictEqual([]);
    expect(cleared.composerMedia.size).toBe(0);
  });

  it('holds lines only for composer windows', () => {
    const [state] = withComposer();

    const next = composerMediaReducer(state, {
      type: 'composerMediaAdd',
      windowId: STATUS_WINDOW_ID,
      item: uploadingMedia('a', 'a.png'),
    });

    expect(next).toBe(state);
    expect(
      composerMediaReducer(state, {
        type: 'composerMediaClear',
        windowId: 'no-such-window',
      }),
    ).toBe(state);
  });

  it('holds the command line’s own lines under the reserved key, with no window', () => {
    const windowId = COMMAND_LINE_MEDIA;
    const added = run(initialAppState(), [
      { type: 'composerMediaAdd', windowId, item: uploadingMedia('a', 'a.png') },
      { type: 'composerMediaAdd', windowId, item: uploadingMedia('b', 'b.png') },
      { type: 'composerMediaPatch', windowId, key: 'a', patch: { description: 'alt' } },
      { type: 'composerMediaRemove', windowId, key: 'b' },
    ]);

    expect(composerMediaOf(added, windowId).map((item) => item.description)).toStrictEqual(['alt']);
    expect(
      composerMediaOf(appReducer(added, { type: 'composerMediaClear', windowId }), windowId),
    ).toStrictEqual([]);
  });

  it('forgets the lines of a closed composer', () => {
    const [state, windowId] = withComposer();
    const added = appReducer(state, {
      type: 'composerMediaAdd',
      windowId,
      item: uploadingMedia('a', 'a.png'),
    });

    const closed = appReducer(added, { type: 'windows', action: { type: 'close', id: windowId } });

    expect(closed.composerMedia.size).toBe(0);
  });
});

describe(readyPatch, () => {
  it('shows a picture’s thumbnail, falling back to the file itself', () => {
    expect(readyPatch(accepted('image', 'https://wired.example/t.png'))).toStrictEqual({
      status: 'ready',
      mediaId: 'm1',
      previewUrl: 'https://wired.example/t.png',
    });
    expect(readyPatch(accepted('gifv', null)).previewUrl).toBe('https://wired.example/media/m1');
  });

  it('shows no thumbnail for video or audio', () => {
    expect(readyPatch(accepted('video', 'https://wired.example/t.png')).previewUrl).toBeNull();
  });
});

describe(heldCount, () => {
  it('counts the lines that did not fail', () => {
    const lines = [
      uploadingMedia('a', 'a.png'),
      { ...uploadingMedia('b', 'b.png'), ...readyPatch(accepted('image', null)) },
      { ...uploadingMedia('c', 'c.png'), ...failedPatch('no') },
    ];

    expect(heldCount(lines)).toBe(2);
  });
});

describe(maxMedia, () => {
  it('falls back to the default for an account nothing is known about', () => {
    expect(maxMedia(initialAppState(), null)).toBe(DEFAULT_MAX_MEDIA_ATTACHMENTS);
  });
});

describe(draftWithMedia, () => {
  it('carries the ids of the accepted attachments, in order', () => {
    const lines = [
      { ...uploadingMedia('a', 'a.png'), ...readyPatch(accepted('image', null)) },
      uploadingMedia('b', 'b.png'),
    ];

    expect(draftWithMedia({ text: 'hi' }, lines)).toStrictEqual({ text: 'hi', mediaIds: ['m1'] });
  });

  it('puts them after the ids the draft already carries', () => {
    const lines = [{ ...uploadingMedia('a', 'a.png'), ...readyPatch(accepted('image', null)) }];

    expect(draftWithMedia({ text: 'hi', mediaIds: ['m0'] }, lines)).toStrictEqual({
      text: 'hi',
      mediaIds: ['m0', 'm1'],
    });
  });

  it('leaves the draft as it is without any', () => {
    const draft = { text: 'hi' };

    expect(draftWithMedia(draft, [uploadingMedia('b', 'b.png')])).toBe(draft);
  });
});
