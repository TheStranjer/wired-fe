/**
 * Tests for the feed window helpers (decision 14): the open transition, the
 * `~name` title and which windows show a feed.
 */
import { describe, expect, it } from 'vitest';

import { feedWindowOpen, feedWindowTitle, showsFeed } from './feedWindow';
import { initialWindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

const FEED = { id: 'f1', name: 'main', sources: [] };

describe('feed windows', () => {
  it('titles a feed window with its name behind a tilde', () => {
    expect(feedWindowTitle(FEED)).toBe('~main');
  });

  it('opens a window with no account whose target is the feed id', () => {
    expect(feedWindowOpen(FEED)).toStrictEqual({
      type: 'open',
      ref: { kind: 'feed', accountKey: null, target: 'f1' },
      title: '~main',
    });
  });

  it('tells the window of a feed from other windows and other feeds', () => {
    const opened = windowsReducer(initialWindowsState(), feedWindowOpen(FEED));
    const [status, feed] = opened.windows;

    expect(feed !== undefined && showsFeed(feed, 'f1')).toBe(true);
    expect(feed !== undefined && showsFeed(feed, 'f2')).toBe(false);
    expect(status !== undefined && showsFeed(status, 'f1')).toBe(false);
  });
});
