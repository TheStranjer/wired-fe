/**
 * Tests for the people window's ref: it carries the watched window's account
 * and id, is titled `people:<title>`, and opens as one window per watched
 * window, found again by the id.
 */
import { describe, expect, it } from 'vitest';

import { peopleWindowId, peopleWindowOpen } from './peopleWindow';
import { initialWindowsState, type WindowState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

/** A thread window owned by account `k`. */
const WATCHED: WindowState = {
  id: 'thread:k:9',
  ref: { kind: 'thread', accountKey: 'k', target: '9' },
  title: 'thread/a0',
  unread: 0,
  highlight: false,
  display: {},
};

describe(peopleWindowOpen, () => {
  it('opens a people window of the same account targeting the watched id', () => {
    expect(peopleWindowOpen(WATCHED)).toStrictEqual({
      type: 'open',
      ref: { kind: 'people', accountKey: 'k', target: 'thread:k:9' },
      title: 'people:thread/a0',
    });
  });

  it('opens the window that peopleWindowId names, once', () => {
    const once = windowsReducer(initialWindowsState(), peopleWindowOpen(WATCHED));
    const twice = windowsReducer(once, peopleWindowOpen(WATCHED));

    expect(twice.windows.map((win) => win.id)).toStrictEqual(['status', peopleWindowId(WATCHED)]);
  });
});
