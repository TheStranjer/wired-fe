/**
 * Tests for the media of the docked boxes (WFE-289): the DM and the thread
 * windows hold lines of their own by window id, kept apart from each other and
 * dropped with the window; windows with no box refuse them.
 */
import { describe, expect, it } from 'vitest';

import type { AppState } from './appState';
import { carriesMedia, composerMediaOf, uploadingMedia } from './composerMedia';
import { appReducer } from './reducer';
import { DM_WINDOW, dmState } from '../test/dmWindow';
import { THREAD_WINDOW, threadState } from '../test/threadWindow';

/** {@link state} with a line named {@link name} added to window {@link windowId}. */
function withLine(state: AppState, windowId: string, name: string): AppState {
  return appReducer(state, {
    type: 'composerMediaAdd',
    windowId,
    item: uploadingMedia(name, name),
  });
}

describe(carriesMedia, () => {
  it.each(['composer', 'dm', 'thread'] as const)('is true for %s windows', (kind) => {
    expect(carriesMedia(kind)).toBe(true);
  });

  it.each(['status', 'home', 'notifications', 'profile'] as const)(
    'is false for %s windows',
    (kind) => {
      expect(carriesMedia(kind)).toBe(false);
    },
  );
});

describe('the media of a docked box', () => {
  it('belongs to the DM window alone', () => {
    const state = withLine(dmState(), DM_WINDOW, 'a.png');

    expect(composerMediaOf(state, DM_WINDOW).map((item) => item.name)).toStrictEqual(['a.png']);
    expect(composerMediaOf(state, 'another-window')).toStrictEqual([]);
  });

  it('belongs to the thread window alone', () => {
    const state = withLine(threadState(), THREAD_WINDOW, 'b.png');

    expect(composerMediaOf(state, THREAD_WINDOW).map((item) => item.name)).toStrictEqual(['b.png']);
    expect(composerMediaOf(state, DM_WINDOW)).toStrictEqual([]);
  });

  it('is forgotten with the window', () => {
    const state = withLine(dmState(), DM_WINDOW, 'a.png');

    const closed = appReducer(state, {
      type: 'windows',
      action: { type: 'close', id: DM_WINDOW },
    });

    expect(closed.composerMedia.size).toBe(0);
  });
});
