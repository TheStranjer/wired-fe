/**
 * Tests for sending from the composer window: the post goes out as the picked
 * account, then the form clears while the window stays and says so in its own
 * scrollback; Ctrl+Enter sends and carries the content warning; a failed send
 * shows its error inside the window with the draft kept, and a retry that goes
 * through clears the error; a window whose account is not signed in is refused.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BOB, MASTO, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';

/** Show the composer window of {@link state}. */
function renderComposer(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={state.windows.activeId} />
    </AppStateProvider>,
  );
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the post textarea. */
function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

/** Press `[ send ]`. */
function send(): void {
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
}

describe('sending from the composer window', () => {
  it('posts as the picked account, then clears the form, stays open and says so', async () => {
    const sent: { readonly auth: string | null; readonly body: unknown }[] = [];
    server.use(
      http.post(`${MASTO}/api/v1/statuses`, async ({ request }) => {
        sent.push({ auth: request.headers.get('authorization'), body: await request.json() });

        return HttpResponse.json(status('9'));
      }),
    );
    renderComposer(openedComposer());
    fireEvent.change(screen.getByRole('combobox', { name: 'Post as' }), {
      target: { value: BOB.key },
    });
    type('hello from bob');

    send();

    const confirmation = await screen.findByText(/Posted as @lain@wired\.example/u);

    expect(confirmation).toBeInTheDocument();
    expect(sent).toStrictEqual([
      { auth: 'Bearer token-2', body: { status: 'hello from bob', visibility: 'public' } },
    ]);
    expect(field()).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Post as' })).toHaveValue(BOB.key);
  });

  it('sends with Ctrl+Enter and carries the content warning', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('9'));
      }),
    );
    renderComposer(openedComposer());
    fireEvent.change(screen.getByRole('textbox', { name: 'Content warning' }), {
      target: { value: 'wired' },
    });
    type('present day');

    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });

    await screen.findByText(/Posted as/u);

    expect(bodies).toStrictEqual([
      { status: 'present day', spoiler_text: 'wired', visibility: 'public' },
    ]);
    expect(screen.getByRole('textbox', { name: 'Content warning' })).toHaveValue('');
  });

  it('shows a failed send inside the window and keeps the draft', async () => {
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
    );
    renderComposer(openedComposer());
    type('this will fail');

    send();

    const failure = await screen.findByText(/HTTP 500/u);

    expect(failure).toBeInTheDocument();
    expect(field()).toHaveValue('this will fail');
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeEnabled();
  });

  it('clears an earlier failure once a retry goes through', async () => {
    server.use(
      http.post(
        `${WIRED}/api/v1/statuses`,
        () => {
          return HttpResponse.json({ error: 'boom' }, { status: 500 });
        },
        { once: true },
      ),
      http.post(`${WIRED}/api/v1/statuses`, () => {
        return HttpResponse.json(status('9'));
      }),
    );
    renderComposer(openedComposer());
    type('again');
    send();
    await screen.findByText(/HTTP 500/u);

    send();

    await screen.findByText(/Posted as/u);

    expect(screen.queryByText(/HTTP 500/u)).toBeNull();
  });

  it('says to log in when the window’s account is not signed in', async () => {
    const state = openedComposer();
    const orphaned = appReducer(state, {
      type: 'windows',
      action: { type: 'setAccount', id: state.windows.activeId, accountKey: 'ghost' },
    });
    renderComposer(orphaned);
    type('nobody home');

    send();

    const refusal = await screen.findByText('Not logged in. Type /connect');

    expect(refusal).toBeInTheDocument();
  });
});
