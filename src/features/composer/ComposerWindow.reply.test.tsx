/**
 * Tests for the reply composer (WFE-244): a composer window bound to a post
 * shows it as a dim "Replying to @author: excerpt" line instead of the "Post
 * as" picker, starts from the mentions, audience and warning the reply
 * computed, posts as the account of the line with the post's id as
 * `in_reply_to_id`, and closes its window once the answer is up — saying so
 * in the status window — while a failed send keeps the window and the draft.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { LAIN, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { replyFields } from '../../state/replyDraft';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** Nine's content-warned, unlisted post, the one the composer answers. */
const POST = status('7', {
  account: { ...status('x').account, acct: 'nine@pleroma.example' },
  content: '<p>the <b>wired</b> is   everywhere</p>',
  spoiler_text: '',
  visibility: 'unlisted',
});

/** A session with the reply composer open, bound to {@link post}. */
function replying(post = POST): AppState {
  const opened = openedComposer();
  const windowId = opened.windows.activeId;
  const patch = replyFields(post, {
    ownAcct: LAIN.handle,
    accountKey: LAIN.key,
    defaultVisibility: 'public',
  });
  return {
    ...opened,
    composers: new Map([[windowId, { ...patch }]]),
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

/** Show the reply composer of {@link state} beside the probe. */
function renderReply(state: AppState): void {
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

describe('the reply composer', () => {
  it('shows the answered post instead of the picker, over the computed fields', () => {
    renderReply(replying());

    expect(
      screen.getByText('Replying to @nine@pleroma.example: the wired is everywhere'),
    ).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Post as' })).toBeNull();
    expect(field()).toHaveValue('@nine@pleroma.example ');
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveValue('unlisted');
  });

  it('shows the warning in place of the words of a post behind one', () => {
    renderReply(replying(status('7', { spoiler_text: 'spoilers' })));

    expect(screen.getByText(/: \[CW: spoilers\]$/u)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Content warning' })).toHaveValue('spoilers');
  });

  it('posts as the line’s account, answering the post, and closes its window', async () => {
    const sent: { readonly auth: string | null; readonly body: unknown }[] = [];
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
        sent.push({ auth: request.headers.get('authorization'), body: await request.json() });

        return HttpResponse.json(status('9'));
      }),
    );
    renderReply(replying());
    fireEvent.change(field(), { target: { value: '@nine@pleroma.example hi' } });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/^status\|.*replied to @/u, { selector: '[data-testid="probe"]' });

    expect(sent).toStrictEqual([
      {
        auth: 'Bearer token-1',
        body: {
          status: '@nine@pleroma.example hi',
          visibility: 'unlisted',
          in_reply_to_id: '7',
        },
      },
    ]);
  });

  it('keeps the window and the draft when the send fails', async () => {
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    renderReply(replying());
    fireEvent.change(field(), { target: { value: '@nine@pleroma.example hi' } });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/HTTP 500/u);

    expect(field()).toHaveValue('@nine@pleroma.example hi');
    expect(screen.getByTestId('probe')).toHaveTextContent(/^status,compose\|/u);
  });
});
