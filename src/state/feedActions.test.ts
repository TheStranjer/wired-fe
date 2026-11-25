/**
 * Tests for what reaches a feed window's buffer: streamed items merge into the
 * feed the buffer keeps (a post two accounts hear is one line, a streamed post
 * survives the next page), a window that is not on screen counts them unread,
 * a fetched page does not, an edit and a delete reach the kept feed as well as
 * the lines so a later merge cannot bring a deleted post back, and a closed
 * window changes nothing.
 */
import { describe, expect, it } from 'vitest';

import { coreReducer } from './appState';
import { notificationItem, postItem } from './feedItem';
import { sourceKey } from './feedMerge';
import { appReducer } from './reducer';
import { bufferFor } from './selectors';
import { A_HOME, B_HOME, post } from '../test/feedItems';
import { feedState, feedWindowId, readLines } from '../test/feedWindow';
import { notification, status } from '../test/fixtures';
import { STATUS_WINDOW_ID } from '../windows/model';

const WINDOW = feedWindowId('f1');

/** A feed window that is open but not the one on screen. */
const IDLE = coreReducer(feedState([{ id: 'f1', name: 'main', sources: [A_HOME, B_HOME] }]), {
  type: 'windows',
  action: { type: 'activate', id: STATUS_WINDOW_ID },
});

/** The window's lines as one string. */
function shown(state: typeof IDLE): string {
  return readLines(bufferFor(state, WINDOW));
}

/** The window's unread count. */
function unread(state: typeof IDLE): number {
  return state.windows.windows.find((win) => win.id === WINDOW)?.unread ?? -1;
}

describe('a streamed item', () => {
  it('joins the feed and counts as unread in a window nobody looks at', () => {
    const next = appReducer(IDLE, {
      type: 'feedLive',
      windowId: WINDOW,
      items: [post('1', 1, A_HOME)],
    });

    expect(shown(next)).toBe(`1@${A_HOME.accountKey}`);
    expect(bufferFor(next, WINDOW).feed?.items).toHaveLength(1);
    expect(unread(next)).toBe(1);
  });

  it('is one line when two accounts hear the same post', () => {
    const first = appReducer(IDLE, {
      type: 'feedLive',
      windowId: WINDOW,
      items: [post('1', 1, A_HOME)],
    });
    const next = appReducer(first, {
      type: 'feedLive',
      windowId: WINDOW,
      items: [post('1', 1, B_HOME)],
    });

    expect(shown(next)).toBe(`1@${A_HOME.accountKey}`);
    expect(bufferFor(next, WINDOW).feed?.items[0]?.seenBy).toStrictEqual([
      A_HOME.accountKey,
      B_HOME.accountKey,
    ]);
    expect(unread(next)).toBe(1);
  });

  it('highlights the window when it is a mention', () => {
    const mention = notificationItem(notification('n1', status('p1')), A_HOME);
    const next = appReducer(IDLE, { type: 'feedLive', windowId: WINDOW, items: [mention] });

    expect(shown(next)).toBe(`notification n1@${A_HOME.accountKey}`);
    expect(next.windows.windows.find((win) => win.id === WINDOW)?.highlight).toBe(true);
  });

  it('survives the next fetched page, which leaves the unread count alone', () => {
    const live = appReducer(IDLE, {
      type: 'feedLive',
      windowId: WINDOW,
      items: [post('live', 9, A_HOME)],
    });
    const paged = appReducer(live, {
      type: 'feed',
      windowId: WINDOW,
      items: [post('old', 1, B_HOME)],
      cursors: { [sourceKey(B_HOME)]: { cursor: null, exhausted: true } },
    });

    expect(shown(paged)).toBe(`old@${B_HOME.accountKey} | live@${A_HOME.accountKey}`);
    expect(bufferFor(paged, WINDOW).feed?.cursors).toStrictEqual({
      [sourceKey(B_HOME)]: { cursor: null, exhausted: true },
    });
    expect(unread(paged)).toBe(1);
  });

  it('changes nothing for a window that is closed', () => {
    const next = appReducer(IDLE, {
      type: 'feedLive',
      windowId: 'feed:-:nope',
      items: [post('1', 1, A_HOME)],
    });

    expect(next).toBe(IDLE);
  });
});

describe('an edit or a delete reaching a feed', () => {
  const loaded = appReducer(IDLE, {
    type: 'feedLive',
    windowId: WINDOW,
    items: [post('2', 2, A_HOME), post('1', 1, A_HOME)],
  });

  it('replaces the post in the lines and in the kept feed', () => {
    const edited = status('1', { content: '<p>edited</p>' });
    const next = appReducer(loaded, { type: 'statusUpdated', status: edited });
    const item = bufferFor(next, WINDOW).feed?.items.find(
      (one) => one.kind === 'post' && one.status.id === '1',
    );
    const line = bufferFor(next, WINDOW).lines.find((one) => one.key === 'post:1');

    expect(item).toMatchObject({ status: edited });
    expect(line).toMatchObject({ status: edited });
  });

  it('replaces a boosted post inside the boost, and leaves the rest as it was', () => {
    const edited = status('1', { content: '<p>edited</p>' });
    const withBoost = appReducer(loaded, {
      type: 'feedLive',
      windowId: WINDOW,
      items: [
        postItem(status('3', { reblog: status('1') }), A_HOME),
        postItem(status('4', { reblog: status('5') }), A_HOME),
        notificationItem(notification('n', status('9')), A_HOME),
      ],
    });
    const next = appReducer(withBoost, { type: 'statusUpdated', status: edited });
    const items = bufferFor(next, WINDOW).feed?.items ?? [];

    expect(items.map((one) => (one.kind === 'post' ? one.status.reblog?.content : null))).toContain(
      '<p>edited</p>',
    );
    expect(items).toHaveLength(5);
  });

  it('takes the post off the lines and the kept feed, so a page cannot bring it back', () => {
    const gone = appReducer(loaded, { type: 'statusDeleted', id: '1' });
    const paged = appReducer(gone, { type: 'feed', windowId: WINDOW, items: [], cursors: {} });

    expect(bufferFor(gone, WINDOW).feed?.items).toHaveLength(1);
    expect(shown(gone)).toBe(`2@${A_HOME.accountKey}`);
    expect(shown(paged)).toBe(`2@${A_HOME.accountKey}`);
  });

  it('leaves a feed that does not show the post as it was', () => {
    expect(appReducer(loaded, { type: 'statusDeleted', id: 'other' })).toBe(loaded);
    expect(appReducer(IDLE, { type: 'statusDeleted', id: '1' })).toBe(IDLE);
    expect(appReducer(loaded, { type: 'statusUpdated', status: status('other') })).toBe(loaded);
    expect(appReducer(IDLE, { type: 'statusUpdated', status: status('1') })).toBe(IDLE);
  });
});
