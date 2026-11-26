/**
 * Tests for completion in a DM window's input box (WFE-302): `@al` lists the
 * person the conversation showed and Tab completes it, Tab with no list is
 * left to the browser, Escape closes the list, `[a` lists the conversation's
 * labels and completes to the post's link, a draft of several lines completes
 * the word on the line the caret is on, and Enter sends with the list open.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { DmInput } from './DmInput';
import type { AppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { ALICE_THREAD, ORIGIN, dmState, showing } from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow } from '../../windows/model';

/** The conversation as the window shows it: alice's thread, newest first. */
function conversation(): AppState {
  return showing(dmState(), ALICE_THREAD.toReversed());
}

/** Render the DM window's box over {@link state}. */
function renderBox(state: AppState = conversation()): void {
  render(
    <AppStateProvider initial={state}>
      <DmInput win={activeWindow(state.windows)} />
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

/** Press Tab in the box; false when the box took the key. */
function tab(): boolean {
  return fireEvent.keyDown(field(), { key: 'Tab' });
}

describe('completion in the DM input', () => {
  it('lists the person the conversation showed, and Tab completes them', () => {
    renderBox();

    type('@al');

    expect(screen.getByRole('option', { name: '@alice@other.example' })).toBeInTheDocument();
    expect(tab()).toBe(false);
    expect(field()).toHaveValue('@alice@other.example ');
  });

  it('leaves Tab to the browser while there is no list', () => {
    renderBox();
    type('hello');

    expect(tab()).toBe(true);
    expect(field()).toHaveValue('hello');
  });

  it('closes the list on Escape', () => {
    renderBox();
    type('@al');

    expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(false);

    expect(screen.queryByRole('option')).toBeNull();
    expect(tab()).toBe(true);
  });

  it('lists the conversation’s labels, newest first, and completes to the post’s link', () => {
    renderBox();

    type('[a');

    const rows = screen.getAllByRole('option').map((row) => row.textContent);

    expect(rows[0]).toBe('[a3] — <@alice@other.example> clones drift away');
    expect(rows).toHaveLength(4);

    tab();

    expect(field()).toHaveValue('https://wired.example/n/8 ');
  });

  it('completes the word on the line the caret is on', () => {
    renderBox();
    type('hello\nthere\n@al');

    tab();

    expect(field()).toHaveValue('hello\nthere\n@alice@other.example ');
  });

  it('sends on Enter with the list open', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('42', { visibility: 'direct' }));
      }),
    );
    renderBox();
    type('@al');

    fireEvent.keyDown(field(), { key: 'Enter' });

    await waitFor(() => {
      expect(field()).toHaveValue('');
    });

    expect(bodies).toHaveLength(1);
  });
});
