/**
 * Tests for the feed window kind: the definition it self-registers — kind,
 * component, the feed's name as the topic line, and no `onPost`, since a feed
 * belongs to no account — and that its component fills its own scrollback
 * from the sources of the feed its ref names, drawn in a log region.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { AppStateProvider } from '../../state/StateContext';
import { A_ACCOUNT, A_ORIGIN, feedState, feedWindowId } from '../../test/feedWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import type { WindowState } from '../../windows/model';

const FEEDS = [
  { id: 'f1', name: 'main', sources: [{ accountKey: A_ACCOUNT.key, source: 'home' }] },
] as const;

describe('the feed window kind', () => {
  it('is the definition for the feed kind, topped by its title, and takes no posts', () => {
    const win: WindowState = {
      id: feedWindowId('f1'),
      ref: { kind: 'feed', accountKey: null, target: 'f1' },
      title: '~main',
      unread: 0,
      highlight: false,
      display: {},
    };

    expect(windowKind.kind).toBe('feed');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeUndefined();
    expect(windowKind.topic(win, feedState(FEEDS))).toBe('~main');
  });

  it('fills its scrollback from the feed its ref names', async () => {
    server.use(
      http.get(`${A_ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json([status('1', { content: '<p>present day</p>' })]),
      ),
    );
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={feedState(FEEDS)}>
        <Component windowId={feedWindowId('f1')} />
      </AppStateProvider>,
    );

    await screen.findByText('present day');

    expect(screen.getByRole('log', { name: 'feed' })).toHaveTextContent('present day');
  });
});
