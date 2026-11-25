/**
 * Tests for the edit composer (WFE-268): a composer window bound to one of the
 * account's own posts shows it as a dim "editing [a0]: excerpt" line instead of
 * the "Post as" picker, holds the post's source text and warning, shows its
 * audience read-only and offers neither attachments nor a poll. Sending saves
 * the edit as a PUT of the post (never a create) with the new text and warning
 * over the media the post keeps; success updates the post in the home window,
 * closes the composer and prints `✎ edited [a0]` in the status window, while a
 * failed send keeps the window and the text and shows the error.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { LAIN, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { STATUS_WINDOW_ID, windowId } from '../../windows/model';

/** Lain's unlisted post under a warning, with a picture: the one the composer edits. */
const POST = status('7', {
  content: '<p>the <b>wired</b> is   everywhere</p>',
  spoiler_text: 'old warning',
  visibility: 'unlisted',
  media_attachments: [{ id: 'm1', type: 'image', url: `${WIRED}/m1.png` }],
});

/** The home window lain sees the post in: it labels it `a0`. */
const HOME = { kind: 'home', accountKey: LAIN.key, target: null } as const;

/** The composer's id, and a session with the edit composer open, bound to {@link POST}. */
function editing(): { readonly composerId: string; readonly state: AppState } {
  const opened = openedComposer();
  const composerId = opened.windows.activeId;
  const withHome = [
    { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
    { type: 'statuses', windowId: windowId(HOME), statuses: [POST], where: 'newer' },
  ] as const;
  const state = withHome.reduce(appReducer, opened);
  return {
    composerId,
    state: {
      ...state,
      composers: new Map([
        [
          composerId,
          {
            text: 'the wired is everywhere',
            spoiler: 'old warning',
            visibility: 'unlisted',
            editing: { status: POST, accountKey: LAIN.key },
          },
        ],
      ]),
    },
  };
}

/** What the session holds of the windows, the home post's text and the status window's lines. */
function Probe(): JSX.Element {
  const state = useAppState();
  const titles = state.windows.windows.map((win) => win.title).join(',');
  const home = (state.buffers.get(windowId(HOME))?.lines ?? []).map((line) =>
    line.kind === 'post' ? line.status.content : '',
  );
  const lines = (state.buffers.get(STATUS_WINDOW_ID)?.lines ?? []).map((line) =>
    line.kind === 'system' ? line.text : '',
  );
  return <p data-testid="probe">{`${titles}|${home.join('')}|${lines.join('|')}`}</p>;
}

/** Show the edit composer beside the probe. */
function renderEdit(): void {
  const { composerId, state } = editing();
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={composerId} />
      <Probe />
    </AppStateProvider>,
  );
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

describe('the edit composer', () => {
  it('shows the post it edits instead of the picker, over its text and warning', () => {
    renderEdit();

    expect(screen.getByText('editing [a0]: [CW: old warning]')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Post as' })).toBeNull();
    expect(field()).toHaveValue('the wired is everywhere');
    expect(screen.getByRole('textbox', { name: 'Content warning' })).toHaveValue('old warning');
  });

  it('shows the audience read-only, and offers no attachments or poll', () => {
    renderEdit();

    expect(screen.getByRole('combobox', { name: 'Visibility' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveValue('unlisted');
    expect(screen.queryByRole('button', { name: 'Attach media' })).toBeNull();
    expect(screen.queryByRole('button', { name: /poll/u })).toBeNull();
  });

  it('saves the edit as a PUT, updates the post, closes the window and says so', async () => {
    const sent: { readonly method: string; readonly body: unknown }[] = [];
    server.use(
      http.put(`${WIRED}/api/v1/statuses/7`, async ({ request }) => {
        sent.push({ method: request.method, body: await request.json() });

        return HttpResponse.json({ ...POST, content: '<p>rewritten</p>' });
      }),
      http.post(`${WIRED}/api/v1/statuses`, () => {
        throw new Error('an edit must not create a post');
      }),
    );
    renderEdit();
    fireEvent.change(field(), { target: { value: 'rewritten' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Content warning' }), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/^status,home\|.*rewritten.*\|✎ edited \[a0\]$/u, {
      selector: '[data-testid="probe"]',
    });

    expect(sent).toStrictEqual([
      {
        method: 'PUT',
        body: { status: 'rewritten', spoiler_text: '', sensitive: false, media_ids: ['m1'] },
      },
    ]);
  });

  it('keeps the window and the text and shows the error when the edit fails', async () => {
    server.use(
      http.put(`${WIRED}/api/v1/statuses/7`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    renderEdit();
    fireEvent.change(field(), { target: { value: 'rewritten' } });

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText(/HTTP 500/u);

    expect(field()).toHaveValue('rewritten');
    expect(screen.getByTestId('probe')).toHaveTextContent(/^status,compose,home\|/u);
  });
});
