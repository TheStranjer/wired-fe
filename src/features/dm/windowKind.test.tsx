/**
 * Tests for the DM window kind's definition and component: it
 * self-registers the `dm` kind, topics its window as the private conversation
 * it is — and plainly when there is nobody to be private with — and its
 * component fetches the stored conversation (one served thread and read mark,
 * src/test/dmWindow) into a log region named after the window's title,
 * reading the thread top to bottom. An unopened window names itself plainly
 * and asks for nothing. Posting through the kind has its own file,
 * windowKind.post.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { AppStateProvider } from '../../state/StateContext';
import { DM_REF, DM_WINDOW, dmState, serveDirect } from '../../test/dmWindow';
import { type WindowState, activeWindow } from '../../windows/model';

/** The index of {@link marker} in the DM window's scrollback text. */
function indexOfMarker(marker: string): number {
  return screen.getByRole('log', { name: 'dm/alice@other.example' }).textContent.indexOf(marker);
}

/** The same window with nothing to target, the way a bare ref opens it. */
function targetless(): WindowState {
  return {
    id: 'dm-targetless',
    ref: { ...DM_REF, target: null },
    title: 'dm/-',
    unread: 0,
    highlight: false,
    display: {},
  };
}

describe('the dm window kind', () => {
  it('is the definition for the dm kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('dm');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window as the private conversation it is', () => {
    const state = dmState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(
      'private conversation with @alice@other.example',
    );
  });

  it('topics a window with nobody to be private with plainly', () => {
    expect(windowKind.topic(targetless(), dmState())).toBe('dm');
  });

  it('shows the loaded conversation under the window title, top to bottom', async () => {
    serveDirect();
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={dmState()}>
        <Component windowId={DM_WINDOW} />
      </AppStateProvider>,
    );

    const log = await screen.findByRole('log', { name: 'dm/alice@other.example' });
    await screen.findByText('present time');

    expect(log).toHaveTextContent('close the world');

    const places = ['close the world', 'hello?', 'present time', 'clones drift away'].map(
      indexOfMarker,
    );

    expect(places).toStrictEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBeGreaterThanOrEqual(0);
  });

  it('names an unopened window’s log region plainly and fetches nothing', () => {
    // No handlers are registered: any request would fail this test.
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={dmState()}>
        <Component windowId="dm:never:opened" />
      </AppStateProvider>,
    );

    expect(screen.getByRole('log', { name: 'dm' })).toBeEmptyDOMElement();
  });
});
