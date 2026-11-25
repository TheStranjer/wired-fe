/**
 * Tests for the display selector: a window's effective density, avatars and
 * images are the reader's settings under the window's own overrides.
 */
import { describe, expect, it } from 'vitest';

import { coreReducer, initialAppState } from './appState';
import { displayFor } from './selectors';
import { STATUS_WINDOW_ID } from '../windows/model';

describe(displayFor, () => {
  it('is the settings for a window with no overrides', () => {
    expect(displayFor(initialAppState(), STATUS_WINDOW_ID)).toStrictEqual({
      density: 'cards',
      avatars: true,
      images: true,
    });
  });

  it('lets a window override a setting', () => {
    const state = coreReducer(initialAppState(), {
      type: 'windows',
      action: { type: 'setDisplay', id: STATUS_WINDOW_ID, overrides: { density: 'lines' } },
    });

    expect(displayFor(state, STATUS_WINDOW_ID)).toStrictEqual({
      density: 'lines',
      avatars: true,
      images: true,
    });
  });

  it('is the settings for a window that is not open', () => {
    expect(displayFor(initialAppState(), 'gone')).toStrictEqual({
      density: 'cards',
      avatars: true,
      images: true,
    });
  });
});
