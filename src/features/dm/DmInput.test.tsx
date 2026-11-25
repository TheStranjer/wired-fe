/**
 * Tests for the input box docked in a DM window (WFE-207): Enter sends the
 * text to the conversation's person, `direct`, answering the newest direct
 * post, then empties the box; Shift+Enter and an empty box send nothing; a
 * failed send shows inside the box with the text kept; focusing the box
 * leaves navigation mode and leaves insert mode alone.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DmInput } from './DmInput';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { ALICE_REPLY, ALICE_THREAD, ORIGIN, dmState, showing } from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow } from '../../windows/model';

const CREATE_URL = `${ORIGIN}/api/v1/statuses`;

/** Shows the keyboard mode the state holds, which the box may change. */
function ModeProbe(): JSX.Element {
  return <output>{useAppState().mode}</output>;
}

/** The DM window's box over {@link state}, with the mode shown beside it. */
function renderBox(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      <DmInput win={activeWindow(state.windows)} />
      <ModeProbe />
    </AppStateProvider>,
  );
}

/** The conversation as the window shows it: alice's thread, newest first. */
function conversation(): AppState {
  return showing(dmState(), ALICE_THREAD.toReversed());
}

/** The box's textarea. */
function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Type {@link text} into the box. */
function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

describe(DmInput, () => {
  it('sends to the person, direct, answering the newest direct post, and empties the box', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('42', { visibility: 'direct' }));
      }),
    );
    renderBox(conversation());
    type('hello');

    fireEvent.keyDown(field(), { key: 'Enter' });

    await screen.findByText('0/500');

    expect(bodies).toStrictEqual([
      {
        status: '@alice@other.example hello',
        visibility: 'direct',
        in_reply_to_id: ALICE_REPLY.id,
      },
    ]);
    expect(field()).toHaveValue('');
  });

  it('sends with the [ send ] button too', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CREATE_URL, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('42', { visibility: 'direct' }));
      }),
    );
    renderBox(conversation());
    type('hello');

    fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));

    await screen.findByText('0/500');

    expect(bodies).toHaveLength(1);
  });

  it('leaves Shift+Enter to the browser, sending nothing', () => {
    // No handler is registered: any request would fail this test.
    renderBox(conversation());
    type('one line');

    const untouched = fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });

    expect(untouched).toBe(true);
    expect(field()).toHaveValue('one line');
  });

  it('sends nothing when the box is empty', () => {
    // No handler is registered: any request would fail this test.
    renderBox(conversation());

    const sent = fireEvent.keyDown(field(), { key: 'Enter' });

    expect(sent).toBe(false);
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeDisabled();
  });

  it('shows a failed send inside the box and keeps the text', async () => {
    server.use(
      http.post(CREATE_URL, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
    );
    renderBox(conversation());
    type('this will fail');

    fireEvent.keyDown(field(), { key: 'Enter' });

    const failure = await screen.findByText(/HTTP 500/u);

    expect(failure).toBeInTheDocument();
    expect(field()).toHaveValue('this will fail');
  });

  it('leaves navigation mode when the box is focused', () => {
    renderBox(appReducer(conversation(), { type: 'mode', mode: 'navigation' }));

    fireEvent.focus(field());

    expect(screen.getByRole('status')).toHaveTextContent('insert');
  });

  it('keeps insert mode when the box is focused', () => {
    renderBox(conversation());

    fireEvent.focus(field());

    expect(screen.getByRole('status')).toHaveTextContent('insert');
  });
});
