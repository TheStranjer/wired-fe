/**
 * Tests for the thread window kind's definition and component: it
 * self-registers the `thread` kind with the window title as its topic, and
 * its component fetches the window's thread (one served conversation,
 * src/test/threadWindow) into a log region named after that title, reading
 * ancestors above the target and replies below it. An unopened window names
 * itself plainly and asks for nothing. Posting through the kind has its own
 * file, windowKind.post.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { AppStateProvider } from '../../state/StateContext';
import { serveThread, THREAD_WINDOW, threadState } from '../../test/threadWindow';
import { activeWindow } from '../../windows/model';

/** The index of {@link marker} in the thread window's scrollback text. */
function indexOfMarker(marker: string): number {
  return screen.getByRole('log', { name: 'thread/a2' }).textContent.indexOf(marker);
}

describe('the thread window kind', () => {
  it('is the definition for the thread kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('thread');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window with the title /thread gave it', () => {
    const state = threadState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('thread/a2');
  });

  it('shows the loaded thread under the window title, top to bottom', async () => {
    serveThread();
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={threadState()}>
        <Component windowId={THREAD_WINDOW} />
      </AppStateProvider>,
    );

    const log = await screen.findByRole('log', { name: 'thread/a2' });
    await screen.findByText('the fourth wall');

    expect(log).toHaveTextContent('first up');

    const places = ['first up', 'second up', 'the fourth wall', 'first down', 'second down'].map(
      indexOfMarker,
    );

    expect(places).toStrictEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBeGreaterThanOrEqual(0);
  });

  it('names an unopened window’s log region plainly and fetches nothing', () => {
    // No handlers are registered: any request would fail this test.
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={threadState()}>
        <Component windowId="thread:never:opened" />
      </AppStateProvider>,
    );

    expect(screen.getByRole('log', { name: 'thread' })).toBeEmptyDOMElement();
  });
});
