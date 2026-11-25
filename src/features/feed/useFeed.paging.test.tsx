/**
 * Tests for paging a feed window over the shared MSW server: an older request
 * asks only the sources that hold the boundary back — the others are not asked
 * at all — and the pages re-merge into the scrollback, held items appearing as
 * the other sources page past them, until every source is exhausted.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useFeed } from './useFeed';
import { AppStateProvider } from '../../state/StateContext';
import { A_HOME, B_HOME, OlderButton, Probe, feed, lines, post } from '../../test/feedHost';
import {
  A_ACCOUNT,
  A_ORIGIN,
  B_ACCOUNT,
  B_ORIGIN,
  feedState,
  feedWindowId,
} from '../../test/feedWindow';
import { server } from '../../test/server';

/** The hook under test, standing in for the window's component. */
function Loader(props: { readonly windowId: string }): JSX.Element {
  useFeed(props.windowId);

  return <Probe windowId={props.windowId} />;
}

/** One page a source answers: its posts, and the cursor its Link header points to, if any. */
type ServedPage = { readonly items: readonly unknown[]; readonly next?: string };

/** Answer GET {@link url} with the page named by the request's `max_id`, recording each one asked for. */
function servePages(url: string, pages: Readonly<Record<string, ServedPage>>): string[] {
  const asked: string[] = [];
  server.use(
    http.get(url, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('max_id') ?? '';
      const page = pages[cursor];

      asked.push(cursor);

      return HttpResponse.json(page?.items ?? [], {
        headers:
          page?.next === undefined ? {} : { Link: `<${url}?max_id=${page.next}>; rel="next"` },
      });
    }),
  );
  return asked;
}

/** The cursors each instance's home timeline was asked for, in order. */
type Asked = { readonly a: string[]; readonly b: string[] };

/** Serve two home timelines of two pages each, and show the feed over them, first page loaded. */
async function renderPaged(): Promise<Asked> {
  const a = servePages(`${A_ORIGIN}/api/v1/timelines/home`, {
    '': { items: [post('h5', 5), post('h3', 3)], next: 'h3' },
    h3: { items: [post('h2', 2)] },
  });
  const b = servePages(`${B_ORIGIN}/api/v1/timelines/home`, {
    '': { items: [post('b4', 4), post('b1', 1)], next: 'b1' },
    b1: { items: [post('b0', 0)] },
  });
  const windowId = feedWindowId('f1');

  render(
    <AppStateProvider initial={feedState([feed([A_HOME, B_HOME])])}>
      <Loader windowId={windowId} />
      <OlderButton windowId={windowId} />
    </AppStateProvider>,
  );
  await screen.findByText('load:loaded exhausted:false');
  return { a, b };
}

/** Ask for older history once and wait until the scrollback reads {@link text}. */
async function pageOlder(text: string | RegExp): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'load older' }));
  await screen.findByText(text);
}

describe(useFeed, () => {
  it('holds back what is older than the boundary on the first page', async () => {
    await renderPaged();

    expect(lines()).toHaveTextContent(
      `h3@${A_ACCOUNT.key} | b4@${B_ACCOUNT.key} | h5@${A_ACCOUNT.key}`,
    );
    expect(lines()).not.toHaveTextContent('b1@');
  });

  it('pages only the source that holds the boundary back, then re-merges', async () => {
    const asked = await renderPaged();

    await pageOlder(/h2@/u);

    expect(lines()).toHaveTextContent(
      `b1@${B_ACCOUNT.key} | h2@${A_ACCOUNT.key} | h3@${A_ACCOUNT.key} | b4@${B_ACCOUNT.key} | h5@${A_ACCOUNT.key}`,
    );
    expect(asked.a).toStrictEqual(['', 'h3']);
    expect(asked.b).toStrictEqual(['']);
  });

  it('pages the remaining source next, and exhausts the feed', async () => {
    const asked = await renderPaged();

    await pageOlder(/h2@/u);
    await pageOlder('load:loaded exhausted:true');

    expect(lines()).toHaveTextContent(`b0@${B_ACCOUNT.key} | b1@${B_ACCOUNT.key}`);
    expect(asked.a).toStrictEqual(['', 'h3']);
    expect(asked.b).toStrictEqual(['', 'b1']);
  });
});
