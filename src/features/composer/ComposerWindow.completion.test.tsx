/**
 * Tests for completion in the composer window's text (WFE-302): `@la` lists
 * the handle the desktop's windows showed and Tab completes it, Tab with no
 * list is left to the browser, `[a` lists the labels of every window shown on
 * the current desktop — each row naming its window, none from a window that is
 * hidden — and completes to the post's link, a draft of several lines completes
 * the word on the line the caret is on, Ctrl+Enter sends with the list open and
 * a bare Enter stays a newline.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { LAIN, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import type { AppAction } from '../../state/reducer';
import { AppStateProvider } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';

/** The window shown beside the composer, and one opened and then covered. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };
const COVERED: WindowRef = { kind: 'federated', accountKey: LAIN.key, target: null };

/** The actions that open {@link ref}, titled {@link title}, with {@link posts} on show. */
function opened(ref: WindowRef, title: string, posts: readonly string[]): readonly AppAction[] {
  return [
    { type: 'windows', action: { type: 'open', ref, title } },
    {
      type: 'statuses',
      windowId: windowId(ref),
      statuses: posts.map((id) => status(id)),
      where: 'newer',
    },
  ];
}

/** The composer's window id in {@link openedComposer}. */
const COMPOSER = openedComposer().windows.activeId;

/** The composer beside the home window; a third window was opened and covered by the second. */
function arranged(): AppState {
  return openedComposer([
    ...opened(COVERED, 'public', ['p']),
    ...opened(HOME, 'home', ['c', 'b', 'a']),
    { type: 'layout', action: { type: 'split', dir: 'row', windowId: COMPOSER } },
  ]);
}

/** Render the composer window over {@link state}. */
function renderComposer(state: AppState = arranged()): void {
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={COMPOSER} />
    </AppStateProvider>,
  );
}

/** The post textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the box, the caret at its end. */
function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

/** Press Tab in the box; false when the box took the key. */
function tab(): boolean {
  return fireEvent.keyDown(field(), { key: 'Tab' });
}

describe('completion in the composer window', () => {
  it('lists a handle a window showed with its display name, and Tab completes it', () => {
    renderComposer();

    type('@la');

    expect(screen.getByRole('option', { name: '@lain@wired.example — Lain' })).toBeInTheDocument();
    expect(tab()).toBe(false);
    expect(field()).toHaveValue('@lain@wired.example ');
  });

  it('leaves Tab to the browser while there is no list', () => {
    renderComposer();
    type('nothing to complete');

    expect(tab()).toBe(true);
    expect(field()).toHaveValue('nothing to complete');
  });

  it('lists the labels of the windows on the desktop, each with its window, and none hidden', () => {
    renderComposer();

    type('[a');

    expect(
      within(screen.getByRole('listbox', { name: 'Post suggestions' }))
        .getAllByRole('option')
        .map((row) => row.textContent),
    ).toStrictEqual([
      '[a2] — home <@lain@wired.example> c',
      '[a1] — home <@lain@wired.example> b',
      '[a0] — home <@lain@wired.example> a',
    ]);
  });

  it('completes a label to the link of the post', () => {
    renderComposer();
    type('see [a1');

    tab();

    expect(field()).toHaveValue('see https://wired.example/n/b ');
  });

  it('never completes a bare label', () => {
    renderComposer();
    type('a1');

    expect(screen.queryByRole('listbox', { name: 'Post suggestions' })).toBeNull();
    expect(tab()).toBe(true);
  });

  it('offers no label of a window the desktop does not show', () => {
    renderComposer(
      openedComposer([
        ...opened(HOME, 'home', ['c']),
        { type: 'windows', action: { type: 'activate', id: COMPOSER } },
      ]),
    );
    type('[a');

    expect(screen.queryByRole('listbox', { name: 'Post suggestions' })).toBeNull();
  });

  it('completes the word on the line the caret is on', () => {
    renderComposer();
    type('first line\nsecond line\n@la');

    tab();

    expect(field()).toHaveValue('first line\nsecond line\n@lain@wired.example ');
  });

  it('leaves a bare Enter to the browser with the list open', () => {
    renderComposer();
    type('@la');

    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(true);
    expect(field()).toHaveValue('@la');
  });

  it('sends on Ctrl+Enter with the list open', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('42'));
      }),
    );
    renderComposer();
    type('@la');

    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
  });
});
