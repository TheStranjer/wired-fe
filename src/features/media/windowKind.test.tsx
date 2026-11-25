/**
 * Tests for the media window kind's definition and its component's notice:
 * it self-registers the `media` kind with the window title as its topic,
 * takes no posts, and a window whose target names no attachment says there is
 * nothing to show and asks for nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { coreReducer } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { mediaState } from '../../test/mediaWindow';
import { activeWindow } from '../../windows/model';

describe('the media window kind', () => {
  it('is the definition for the media kind, and it takes no posts', () => {
    expect(windowKind.kind).toBe('media');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeUndefined();
  });

  it('topics its window with the title /media gave it', () => {
    const state = mediaState(1, 3);

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('media [a0] 1/3');
  });

  it('has nothing to show for a window that was never opened', () => {
    const { Component } = windowKind;
    // No handlers are registered: any request would fail this test.
    render(
      <AppStateProvider initial={mediaState(1, 3)}>
        <Component windowId="media:never:opened" />
      </AppStateProvider>,
    );

    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('has nothing to show for a window whose target is not an attachment', () => {
    const opened = coreReducer(mediaState(1, 3), {
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'media', accountKey: 'k', target: 'bad' },
        title: 'media',
      },
    });
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={opened}>
        <Component windowId={activeWindow(opened.windows).id} />
      </AppStateProvider>,
    );

    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });
});
