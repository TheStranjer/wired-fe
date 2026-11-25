/**
 * Tests for the feed loader over the shared MSW server: three sources across
 * two accounts merge and dedupe into one scrollback whose lines remember the
 * account that fetched them, posts and notifications each become their own
 * kind of line, a failing source prints one message and is skipped while the
 * rest load, and a feed whose spec is gone (or a window with no feed at all)
 * says so and asks nothing. Paging is in useFeed.paging.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useFeed } from './useFeed';
import type { AppState } from '../../state/appState';
import { bufferFor } from '../../state/selectors';
import { AppStateProvider } from '../../state/StateContext';
import {
  A_HOME,
  A_LOCAL,
  A_NOTIFICATIONS,
  B_HOME,
  OlderButton,
  Probe,
  feed,
  lines,
  post,
} from '../../test/feedHost';
import {
  A_ACCOUNT,
  A_ORIGIN,
  B_ACCOUNT,
  B_ORIGIN,
  feedState,
  feedWindowId,
} from '../../test/feedWindow';
import { notification } from '../../test/fixtures';
import { server } from '../../test/server';

/** The hook under test, standing in for the window's component. */
function Loader(props: { readonly windowId: string }): JSX.Element {
  useFeed(props.windowId);

  return <Probe windowId={props.windowId} />;
}

/** Show the feed window of {@link state}. */
function renderFeed(state: AppState, target: string | null = 'f1'): void {
  const windowId = feedWindowId(target);

  render(
    <AppStateProvider initial={state}>
      <Loader windowId={windowId} />
      <OlderButton windowId={windowId} />
    </AppStateProvider>,
  );
}

describe(useFeed, () => {
  it('merges three sources of two accounts, dedupes, and stamps each line with its account', async () => {
    server.use(
      http.get(`${A_ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json([post('30', 3, { uri: 'https://x.example/u3' }), post('10', 1)]),
      ),
      http.get(`${A_ORIGIN}/api/v1/timelines/public`, () => HttpResponse.json([post('40', 4)])),
      http.get(`${B_ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json([post('300', 3, { uri: 'https://x.example/u3' }), post('200', 2)]),
      ),
    );

    renderFeed(feedState([feed([A_HOME, A_LOCAL, B_HOME])]));
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent(
      `10@${A_ACCOUNT.key} | 200@${B_ACCOUNT.key} | 30@${A_ACCOUNT.key} | 40@${A_ACCOUNT.key}`,
    );
  });

  it('shows notifications as notification lines and posts as post lines', async () => {
    server.use(
      http.get(`${A_ORIGIN}/api/v1/notifications`, () =>
        HttpResponse.json([notification('7', null)]),
      ),
      http.get(`${B_ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([post('200', 2)])),
    );

    renderFeed(feedState([feed([A_NOTIFICATIONS, B_HOME])]));
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent(`200@${B_ACCOUNT.key} | notification 7@${A_ACCOUNT.key}`);
  });

  it('prints one message for a failing source and loads the rest', async () => {
    server.use(
      http.get(`${A_ORIGIN}/api/v1/timelines/home`, () =>
        HttpResponse.json({ error: 'Boom' }, { status: 500 }),
      ),
      http.get(`${B_ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([post('200', 2)])),
    );

    renderFeed(feedState([feed([A_HOME, B_HOME])]));
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent(
      `200@${B_ACCOUNT.key} | system @lain@a.example:home failed: HTTP 500: Boom`,
    );
  });

  it('names a source of an account no longer signed in by its key, and loads the rest', async () => {
    server.use(
      http.get(`${B_ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([post('200', 2)])),
    );
    const gone = { accountKey: 'https://gone.example#9', source: 'home' } as const;

    renderFeed(feedState([feed([gone, B_HOME])]));
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent(`200@${B_ACCOUNT.key}`);
    expect(lines()).toHaveTextContent('@https://gone.example#9:home failed:');
  });

  it('says so, and asks nothing, when the feed no longer exists', async () => {
    renderFeed(feedState([], 'gone'), 'gone');
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent('system This feed no longer exists');
  });

  it('says so, and asks nothing, when the window names no feed', async () => {
    renderFeed(feedState([feed([A_HOME])], null), null);
    await screen.findByText('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent('system This feed no longer exists');
  });

  it('asks nothing when the buffer is not idle', async () => {
    // No handlers are registered: any request would fail this test.
    const state = feedState([feed([A_HOME])]);
    const loaded = {
      ...state,
      buffers: new Map(state.buffers).set(feedWindowId('f1'), {
        ...bufferFor(state, feedWindowId('f1')),
        load: 'loaded' as const,
      }),
    };

    renderFeed(loaded);
    await screen.findByText('load:loaded exhausted:false');

    expect(lines()).toBeEmptyDOMElement();
  });
});
