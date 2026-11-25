/**
 * Tests for the composer window's poll editor (WFE-206), the editor itself:
 * the `[ ☰ poll ]` toggle shows and hides it, options add and remove within the
 * instance's bounds, and the limits and durations follow the posting account's
 * capabilities, also after the "Post as" picker moves.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BOB, MASTO_POLL_LIMITS, openedComposer } from './composerSession';
import { button, openPoll, renderComposer, typeInto } from './pollHarness';

describe('the poll toggle', () => {
  it('shows the editor when pressed, aria-pressed following', () => {
    renderComposer(openedComposer());

    expect(button(/poll/u)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox', { name: 'Option 1' })).toBeNull();

    openPoll();

    expect(button(/poll/u)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Option 1' })).toBeInTheDocument();
  });

  it('hides the editor when pressed again', () => {
    renderComposer(openedComposer());
    openPoll();

    openPoll();

    expect(button(/poll/u)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox', { name: 'Option 1' })).toBeNull();
  });

  it('starts at a day, single choice, totals shown', () => {
    renderComposer(openedComposer());

    openPoll();

    expect(screen.getByRole('combobox', { name: 'Duration' })).toHaveValue('86400');
    expect(screen.getByRole('checkbox', { name: 'Multiple choice' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Hide totals' })).not.toBeChecked();
  });
});

describe('the options', () => {
  it('adds up to the instance’s maximum and no further', () => {
    renderComposer(openedComposer());
    openPoll();

    fireEvent.click(button('[+ option]'));
    fireEvent.click(button('[+ option]'));

    expect(screen.getByRole('textbox', { name: 'Option 4' })).toBeInTheDocument();
    expect(button('[+ option]')).toBeDisabled();
  });

  it('removes down to two and no further', () => {
    renderComposer(openedComposer());
    openPoll();
    fireEvent.click(button('[+ option]'));
    typeInto('Option 3', 'birds');

    fireEvent.click(button('Remove option 1'));

    expect(screen.getByRole('textbox', { name: 'Option 2' })).toHaveValue('birds');
    expect(screen.queryByRole('textbox', { name: 'Option 3' })).toBeNull();
    expect(button('Remove option 1')).toBeDisabled();
    expect(button('Remove option 2')).toBeDisabled();
  });

  it('counts each option against the instance’s length', () => {
    renderComposer(openedComposer());
    openPoll();

    typeInto('Option 1', 'cats');

    expect(screen.getByText('4/50')).toBeInTheDocument();
  });
});

describe('the limits of the posting account', () => {
  it('offers the seven durations the default limits allow', () => {
    renderComposer(openedComposer());
    openPoll();

    const labels = within(screen.getByRole('combobox', { name: 'Duration' }))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toStrictEqual(['5 min', '30 min', '1 h', '6 h', '1 d', '3 d', '7 d']);
  });

  it('fits the poll to the account picked next: fewer options, nearer run, new length', () => {
    renderComposer(openedComposer());
    openPoll();
    fireEvent.click(button('[+ option]'));
    fireEvent.click(button('[+ option]'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Duration' }), {
      target: { value: '604800' },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Post as' }), {
      target: { value: BOB.key },
    });

    expect(screen.queryByRole('textbox', { name: 'Option 4' })).toBeNull();
    expect(button('[+ option]')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Duration' })).toHaveValue('86400');
    expect(
      within(screen.getByRole('combobox', { name: 'Duration' })).getAllByRole('option'),
    ).toHaveLength(3);
    expect(
      screen.getAllByText(`0/${String(MASTO_POLL_LIMITS.maxCharactersPerOption)}`),
    ).toHaveLength(3);
  });

  it('leaves a picked account change alone while no poll is open', () => {
    renderComposer(openedComposer());

    fireEvent.change(screen.getByRole('combobox', { name: 'Post as' }), {
      target: { value: BOB.key },
    });

    expect(button(/poll/u)).toHaveAttribute('aria-pressed', 'false');
  });
});
