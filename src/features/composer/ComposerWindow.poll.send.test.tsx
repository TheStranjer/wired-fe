/**
 * Tests for sending from the composer window's poll editor (WFE-206): empty,
 * repeated and over-long options are shown inline and keep `[ send ]` off, the
 * poll goes out in the create payload, and media and a poll exclude each other
 * with the reason shown.
 */
import { fireEvent, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { WIRED, openedComposer } from './composerSession';
import { button, fillValid, openPoll, renderComposer, typeInto } from './pollHarness';
import type { AppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';

describe('validation', () => {
  it('shows an empty option inline and keeps send off', () => {
    renderComposer(openedComposer());
    openPoll();
    typeInto('Post text', 'which?');
    typeInto('Option 1', 'cats');

    expect(screen.getByText('Option 2 is empty')).toBeInTheDocument();
    expect(button('[ send ]')).toBeDisabled();
  });

  it('shows a repeated option inline and keeps send off', () => {
    renderComposer(openedComposer());
    openPoll();
    fillValid();

    typeInto('Option 2', 'Cats');

    expect(screen.getByText('Option 2 repeats option 1')).toBeInTheDocument();
    expect(button('[ send ]')).toBeDisabled();
  });

  it('shows an over-long option with its counter and keeps send off', () => {
    renderComposer(openedComposer());
    openPoll();
    fillValid();

    typeInto('Option 1', 'x'.repeat(51));

    expect(screen.getByText('Option 1 is over 50 characters')).toBeInTheDocument();
    expect(button('[ send ]')).toBeDisabled();
  });

  it('enables send once every option is fine', () => {
    renderComposer(openedComposer());
    openPoll();

    fillValid();

    expect(button('[ send ]')).toBeEnabled();
  });
});

describe('sending a poll', () => {
  it('puts the poll in the payload, then closes the editor with the form', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(status('9'));
      }),
    );
    renderComposer(openedComposer());
    openPoll();
    fillValid();
    fireEvent.change(screen.getByRole('combobox', { name: 'Duration' }), {
      target: { value: '3600' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Multiple choice' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide totals' }));

    fireEvent.click(button('[ send ]'));

    await screen.findByText(/Posted as/u);

    expect(bodies).toStrictEqual([
      {
        status: 'which?',
        visibility: 'public',
        poll: { options: ['cats', 'dogs'], expires_in: 3600, multiple: true, hide_totals: true },
      },
    ]);
    expect(button(/poll/u)).toHaveAttribute('aria-pressed', 'false');
  });
});

/** A composer carrying one media, with {@link poll} open when asked. */
function withMedia(poll: boolean): AppState {
  const base = openedComposer();
  const patch = poll
    ? { mediaIds: ['m1'], poll: { options: ['a', 'b'], expiresIn: 86_400, multiple: false } }
    : { mediaIds: ['m1'] };
  return appReducer(base, { type: 'composerEdit', windowId: base.windows.activeId, patch });
}

describe('media and a poll', () => {
  it('turns the toggle off and says why while the draft carries media', () => {
    renderComposer(withMedia(false));

    expect(button(/poll/u)).toBeDisabled();
    expect(screen.getByText('A post can’t carry both media and a poll')).toBeInTheDocument();
  });

  it('keeps send off while a poll and media are both there, until the poll is closed', () => {
    renderComposer(withMedia(true));
    typeInto('Post text', 'which?');

    expect(button('[ send ]')).toBeDisabled();

    openPoll();

    expect(button('[ send ]')).toBeEnabled();
  });
});
