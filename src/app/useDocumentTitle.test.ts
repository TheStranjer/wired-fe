/**
 * Tests for the tab title: the app name alone while every window is read, the
 * total unread count in front of it, the `* ` marker in front of that while
 * any window is highlighted, the title following the window list as it
 * changes, and the title the document came with handed back on unmount.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { documentTitle, useDocumentTitle } from './useDocumentTitle';
import { buildConfig } from '../config/config';
import { initialWindowsState, windowId } from '../windows/model';
import type { WindowRef, WindowsState, WindowState } from '../windows/model';

/** The name this build puts in the title, straight from the config (decision 3). */
const APP_NAME = buildConfig.appName;

/** A home view; only its unread state matters to the title. */
const HOME: WindowRef = { kind: 'home', accountKey: 'lain@wired.example', target: null };

/** The home window carrying {@link unread} lines and {@link highlight}. */
function home(unread: number, highlight: boolean): WindowState {
  return { id: windowId(HOME), ref: HOME, title: 'home', unread, highlight, display: {} };
}

/** A window list of window 1 plus {@link extra}, with window 1 active. */
function windowsOf(...extra: WindowState[]): WindowsState {
  const initial = initialWindowsState();
  return { ...initial, windows: [...initial.windows, ...extra] };
}

describe(documentTitle, () => {
  it('names the app while nothing is unread', () => {
    expect(documentTitle(windowsOf(), APP_NAME)).toBe(APP_NAME);
  });

  it('totals the unread lines of every window', () => {
    const windows = windowsOf(home(1, false), home(2, false));

    expect(documentTitle(windows, APP_NAME)).toBe(`(3) ${APP_NAME}`);
  });

  it('marks a highlighted window in front of the tally', () => {
    const windows = windowsOf(home(3, true));

    expect(documentTitle(windows, APP_NAME)).toBe(`* (3) ${APP_NAME}`);
  });

  it('marks a highlight whose lines are already read', () => {
    const windows = windowsOf(home(0, true));

    expect(documentTitle(windows, APP_NAME)).toBe(`* ${APP_NAME}`);
  });
});

describe(useDocumentTitle, () => {
  afterEach(() => {
    document.title = '';
  });

  it('titles the tab with the app name while nothing is unread', () => {
    renderHook(() => {
      useDocumentTitle(windowsOf(home(0, false)));
    });

    expect(document.title).toBe(APP_NAME);
  });

  it('titles the tab with the unread total', () => {
    renderHook(() => {
      useDocumentTitle(windowsOf(home(4, false)));
    });

    expect(document.title).toBe(`(4) ${APP_NAME}`);
  });

  it('titles the tab with the highlight marker', () => {
    renderHook(() => {
      useDocumentTitle(windowsOf(home(3, true)));
    });

    expect(document.title).toBe(`* (3) ${APP_NAME}`);
  });

  it('follows the windows as they are read', () => {
    const { rerender } = renderHook(
      ({ windows }: { windows: WindowsState }) => {
        useDocumentTitle(windows);
      },
      { initialProps: { windows: windowsOf(home(3, true)) } },
    );

    rerender({ windows: windowsOf(home(0, false)) });

    expect(document.title).toBe(APP_NAME);
  });

  it('restores the title the document came with on unmount', () => {
    document.title = 'Where the tab started';
    const { unmount } = renderHook(() => {
      useDocumentTitle(windowsOf(home(2, false)));
    });

    expect(document.title).toBe(`(2) ${APP_NAME}`);

    unmount();

    expect(document.title).toBe('Where the tab started');
  });
});
