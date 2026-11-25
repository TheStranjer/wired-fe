/**
 * Tests for the account marker in a feed window's lines (decision 14, WFE-226):
 * a post or notification of a feed whose sources span several accounts says
 * which account it came through — on a card and on an IRC line, once per item —
 * and a single-account feed or an ordinary window says nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import { type AppState, coreReducer } from '../state/appState';
import { type FeedItem, notificationItem, postItem } from '../state/feedItem';
import type { FeedSpec } from '../state/feeds';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import { A_HOME, B_HOME } from '../test/feedItems';
import { A_ACCOUNT, B_ACCOUNT, feedState, feedWindowId } from '../test/feedWindow';
import { status } from '../test/fixtures';
import { note } from '../test/notificationCards';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const BOTH = [A_ACCOUNT.key, B_ACCOUNT.key];
const FEED: FeedSpec = {
  id: 'f1',
  name: 'main',
  sources: [
    { accountKey: A_ACCOUNT.key, source: 'home' },
    { accountKey: B_ACCOUNT.key, source: 'home' },
  ],
};
const ONE_ACCOUNT: FeedSpec = {
  ...FEED,
  sources: [FEED.sources[0] ?? A_HOME, { accountKey: A_ACCOUNT.key, source: 'local' }],
};
const WINDOW = feedWindowId('f1');

/** A post item of account one that both accounts saw. */
const SHARED: FeedItem = { ...postItem(status('p'), A_HOME), seenBy: BOTH };

/** The feed over `feed` showing `items`, drawn as `density`. */
function shown(
  items: readonly FeedItem[],
  density: 'cards' | 'lines' = 'cards',
  feed: FeedSpec = FEED,
): AppState {
  const feedItems = appReducer(feedState([feed]), { type: 'feed', windowId: WINDOW, items });
  return coreReducer(feedItems, {
    type: 'windows',
    action: { type: 'setDisplay', id: WINDOW, overrides: { density } },
  });
}

/** Render every line of window `id` over `state`. */
function renderLines(state: AppState, id: string = WINDOW): HTMLElement {
  return render(
    <AppStateProvider initial={state}>
      {bufferFor(state, id).lines.map((line) => (
        <LineView key={line.key} line={line} windowId={id} />
      ))}
    </AppStateProvider>,
  ).container;
}

describe('the marker on a feed post', () => {
  it('sits in the card header, with every account in its name', () => {
    renderLines(shown([SHARED]));

    expect(screen.getByRole('note')).toHaveTextContent('→ @lain +1');
    expect(
      screen.getByRole('note', { name: 'via @lain@a.example, @navi@b.example' }),
    ).toBeVisible();
  });

  it('follows the clock on an IRC line', () => {
    const container = renderLines(shown([SHARED], 'lines'));

    expect(container.textContent).toMatch(/\d\d:\d\d →lain \+1 </u);
  });

  it('names the one account that saw a post, as that account fetched it', () => {
    renderLines(shown([postItem(status('p'), B_HOME)]));

    expect(screen.getByRole('note')).toHaveTextContent(/^→ @navi$/u);
  });

  it('is absent when the feed uses a single account', () => {
    renderLines(shown([SHARED], 'cards', ONE_ACCOUNT));

    expect(screen.queryByRole('note')).toBeNull();
  });

  it('is absent from an ordinary window', () => {
    const ref: WindowRef = { kind: 'home', accountKey: A_ACCOUNT.key, target: null };
    const opened = coreReducer(shown([]), {
      type: 'windows',
      action: { type: 'open', ref, title: 'home' },
    });
    const state = appReducer(opened, {
      type: 'statuses',
      windowId: windowId(ref),
      statuses: [status('p')],
      where: 'newer',
    });
    renderLines(state, windowId(ref));

    expect(screen.getByRole('article')).toBeVisible();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

/** A notification of `type` over a post, as account two's home fetched it. */
function noted(type: string, withPost: boolean): FeedItem {
  return notificationItem(note(type, withPost ? status('about') : null), B_HOME);
}

describe('the marker on a feed notification', () => {
  it('sits in a compact card header', () => {
    renderLines(shown([noted('favourite', true)]));

    expect(screen.getByRole('note')).toHaveTextContent('→ @navi');
  });

  it('follows the clock of an IRC sentence', () => {
    const container = renderLines(shown([noted('follow', false)], 'lines'));

    expect(container.textContent).toMatch(/\d\d:\d\d →navi \*\*\* /u);
  });

  it.each(['cards', 'lines'] as const)('appears once on a mention drawn as %s', (density) => {
    renderLines(shown([noted('mention', true)], density));

    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it.each(['cards', 'lines'] as const)('appears once on a quote drawn as %s', (density) => {
    renderLines(shown([noted('quote', true)], density));

    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it.each(['cards', 'lines'] as const)(
    'is absent in a single-account feed drawn as %s',
    (density) => {
      renderLines(shown([noted('favourite', true)], density, ONE_ACCOUNT));

      expect(screen.queryByRole('note')).toBeNull();
    },
  );
});
