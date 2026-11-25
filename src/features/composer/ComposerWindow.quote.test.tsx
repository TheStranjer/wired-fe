/**
 * Tests for the quote composer (WFE-262): a composer window bound to a post
 * shows it as a dim "Quoting @author: excerpt" line instead of the "Post as"
 * picker, posts as the account of the line with the post's id as `quote_id`
 * and no reply id, and closes its window once the quote is up — saying so in
 * the status window — while a failed send keeps the window and the draft.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { LAIN, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** Nine's post, the one the composer quotes. */
const POST = status('7', {
  account: { ...status('x').account, acct: 'nine@pleroma.example' },
  content: '<p>the <b>wired</b> is   everywhere</p>',
});

/** A session with the quote composer open, bound to {@link POST}. */
function quoting(): AppState {
  const opened = openedComposer();
  const windowId = opened.windows.activeId;
  return {
    ...opened,
    composers: new Map([
      [
        windowId,
        {
          text: '',
          spoiler: '',
          visibility: 'public',
          quoteOf: { status: POST, accountKey: LAIN.key },
        },
      ],
    ]),
  };
}

/** What the session holds of the windows and the status window's lines, as text. */
function Probe(): JSX.Element {
  const state = useAppState();
  const titles = state.windows.windows.map((win) => win.title).join(',');
  const lines = (state.buffers.get(STATUS_WINDOW_ID)?.lines ?? []).map((line) =>
    line.kind === 'system' ? line.text : '',
  );
  return <p data-testid="probe">{`${titles}|${lines.join('|')}`}</p>;
}

/** Show the quote composer of {@link state} beside the probe. */
function renderQuote(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={state.windows.activeId} />
      <Probe />
    </AppStateProvider>,
  );
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

describe('the quote composer', () => {
  it('shows the quoted post instead of the picker, over an empty text', () => {
    renderQuote(quoting());

    expect(
      screen.getByText('Quoting @nine@pleroma.example: the wired is everywhere'),
    ).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Post as' })).toBeNull();
    expect(field()).toHaveValue('');
  });

  it('posts as the line’s account with quote_id and no reply, and closes its window', async () => {
    const sent: { readonly auth: string | null; readonly body: unknown }[] = [];
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
        sent.push({ auth: request.headers.get('authorization'), body: await request.json() });

        return HttpResponse.json(status('9'));
      }),
    );
    renderQuote(quoting());
    fireEvent.change(field(), { target: { value: 'so true' } });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/^status\|.*quoted @nine@pleroma\.example/u, {
      selector: '[data-testid="probe"]',
    });

    expect(sent).toStrictEqual([
      {
        auth: 'Bearer token-1',
        body: { status: 'so true', visibility: 'public', quote_id: '7' },
      },
    ]);
  });

  it('keeps the window and the draft when the send fails', async () => {
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    renderQuote(quoting());
    fireEvent.change(field(), { target: { value: 'so true' } });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/HTTP 500/u);

    expect(field()).toHaveValue('so true');
    expect(screen.getByTestId('probe')).toHaveTextContent(/^status,compose\|/u);
  });
});
