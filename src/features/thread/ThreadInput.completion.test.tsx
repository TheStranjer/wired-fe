/**
 * Tests for completion in a thread window's input box (WFE-302): `@la` lists
 * the handle the thread showed and Tab completes it, Tab with no list is left
 * to the browser, Escape closes the list and the box keeps focus, Tab cycles
 * and Shift+Tab steps back through a bare Shift press, Enter sends whether or
 * not the list is open, `[a` lists the thread's labels and completes to the
 * post's link, a click on a row completes, and the word is found on any line
 * and mid-text.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ThreadInput } from './ThreadInput';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider } from '../../state/StateContext';
import { wireAccount } from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import {
  FIRST_DOWN,
  ORIGIN,
  SECOND_UP,
  THREAD_TARGET,
  THREAD_WINDOW,
  threadState,
} from '../../test/threadWindow';

/** The row the thread's own author is listed as. */
const LAIN_ROW = '@lain@wired.example — Lain';

/** The thread window with three posts on show. */
function loaded(): AppState {
  return appReducer(threadState(true), {
    type: 'statuses',
    windowId: THREAD_WINDOW,
    statuses: [FIRST_DOWN, THREAD_TARGET, SECOND_UP],
    where: 'newer',
  });
}

/** Render the thread window's box over {@link state}. */
function renderBox(state: AppState = loaded()): void {
  const win = state.windows.windows.find((candidate) => candidate.id === THREAD_WINDOW);
  if (win === undefined) {
    throw new Error('the thread window is not open');
  }
  render(
    <AppStateProvider initial={state}>
      <ThreadInput win={win} />
    </AppStateProvider>,
  );
}

/** The box's textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the box, the caret at its end. */
function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

/** Press Tab in the box (with Shift for {@link back}); false when the box took the key. */
function tab(back = false): boolean {
  return fireEvent.keyDown(field(), { key: 'Tab', shiftKey: back });
}

describe('completion in the thread input', () => {
  it('lists a handle the thread showed with its display name, and Tab completes it', () => {
    renderBox();

    type('@la');

    expect(screen.getByRole('option', { name: LAIN_ROW })).toBeInTheDocument();
    expect(tab()).toBe(false);
    expect(field()).toHaveValue('@lain@wired.example ');
    expect(field().selectionStart).toBe('@lain@wired.example '.length);
  });

  it('completes a click on a row and keeps the focus in the box', () => {
    renderBox();
    type('hello @la');

    fireEvent.click(screen.getByRole('option', { name: LAIN_ROW }));

    expect(field()).toHaveValue('hello @lain@wired.example ');
    expect(field()).toHaveFocus();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('leaves Tab to the browser while there is no list', () => {
    renderBox();
    type('plain words');

    expect(tab()).toBe(true);
    expect(tab(true)).toBe(true);
    expect(field()).toHaveValue('plain words');
  });

  it('closes the list on Escape and leaves Tab to the browser until the text changes', () => {
    renderBox();
    type('@la');

    expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(false);

    expect(screen.queryByRole('option')).toBeNull();
    expect(tab()).toBe(true);
    expect(field()).toHaveValue('@la');

    type('@lai');

    expect(screen.getByRole('option', { name: LAIN_ROW })).toBeInTheDocument();
  });

  it('leaves Escape alone while there is no list', () => {
    renderBox();
    type('plain');

    expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(true);
  });

  it('cycles with Tab and steps back with Shift+Tab, a bare Shift press changing nothing', () => {
    renderBox();
    type('[a');
    tab();
    const first = field().value;
    tab();
    const second = field().value;

    fireEvent.keyDown(field(), { key: 'Shift' });

    expect(second).not.toBe(first);

    tab(true);

    expect(field()).toHaveValue(first);
  });

  it('ends the completion on any other key, and Tab then has nothing to complete', () => {
    renderBox();
    type('[a');
    tab();
    const completed = field().value;

    fireEvent.keyDown(field(), { key: 'ArrowLeft' });

    expect(tab()).toBe(true);
    expect(field()).toHaveValue(completed);
  });

  it('lists the thread’s labels with their authors and completes to the post’s link', () => {
    renderBox();

    type('see [a');

    expect(
      screen.getByRole('option', { name: '[a1] — <@lain@wired.example> the fourth wall' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('option', { name: '[a1] — <@lain@wired.example> the fourth wall' }),
    );

    expect(field()).toHaveValue('see https://wired.example/n/5 ');
  });

  it('never completes a bare label', () => {
    renderBox();
    type('a1');

    expect(screen.queryByRole('option')).toBeNull();
    expect(tab()).toBe(true);
  });

  it('completes the word at the caret on its own line and in the middle of the text', () => {
    renderBox();
    type('first line\n@la');
    tab();

    expect(field()).toHaveValue('first line\n@lain@wired.example ');

    type('one @la two');
    field().setSelectionRange(7, 7);
    fireEvent.keyUp(field(), { key: 'ArrowLeft' });
    tab();

    expect(field()).toHaveValue('one @lain@wired.example  two');
  });

  it('lists an emoji with its image once the instance has served it, and Tab completes it', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () =>
        HttpResponse.json([{ shortcode: 'fox', url: `${ORIGIN}/e/fox.png` }]),
      ),
    );
    renderBox();

    type('hi :fo');

    const image = await screen.findByRole('img', { name: ':fox:' });

    expect(image).toHaveAttribute('src', `${ORIGIN}/e/fox.png`);

    tab();

    expect(field()).toHaveValue('hi :fox: ');
  });

  it('lists the accounts the instance finds for a handle, and Tab completes one', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () =>
        HttpResponse.json({
          accounts: [{ ...wireAccount('11', 'alex@o.example'), display_name: 'Alex Mercer' }],
        }),
      ),
    );
    renderBox();

    type('@al');

    const row = await screen.findByRole('option', { name: '@alex@o.example — Alex Mercer' });

    expect(row).toBeInTheDocument();

    tab();

    expect(field()).toHaveValue('@alex@o.example ');
  });

  it('sends on Enter with the list open and completes nothing', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('42'));
      }),
    );
    renderBox();
    type('@la');

    fireEvent.keyDown(field(), { key: 'Enter' });

    await waitFor(() => {
      expect(field()).toHaveValue('');
    });

    expect(bodies).toStrictEqual([{ status: '@la', visibility: 'public', in_reply_to_id: '5' }]);
  });
});
