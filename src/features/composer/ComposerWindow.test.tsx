/**
 * Tests for the composer window's form and its "Post as" picker: the form shows
 * the posting account's limit and audiences, the picker lists every signed-in
 * account, and picking one moves the window to it — its character limit and
 * audiences follow, an audience the new instance does not serve falls back to
 * the default, and the text typed so far is counted against the new limit.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BOB, LAIN, WIRED, accountOf, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import type { AppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';

/** Show the composer window of {@link state} (or window {@link id}). */
function renderComposer(state: AppState, id: string = state.windows.activeId): void {
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={id} />
    </AppStateProvider>,
  );
}

/** The select named {@link name}. */
function select(name: string): HTMLElement {
  return screen.getByRole('combobox', { name });
}

/** Choose {@link value} in the select named {@link name}. */
function choose(name: string, value: string): void {
  fireEvent.change(select(name), { target: { value } });
}

describe(ComposerWindow, () => {
  it('shows the form with the posting account’s limit and a Post as picker', () => {
    renderComposer(openedComposer());

    expect(select('Post as')).toHaveValue(LAIN.key);
    expect(screen.getByText('0/30')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'compose' })).toBeInTheDocument();
    expect(within(select('Visibility')).getByRole('option', { name: 'local' })).toBeInTheDocument();
  });

  it('lists every signed-in account in the picker', () => {
    renderComposer(openedComposer());

    const options = within(select('Post as')).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toStrictEqual([
      '@lain@wired.example',
      '@bob@mastodon.example',
    ]);
  });

  it('moves to the picked account, with its limit and audiences', () => {
    renderComposer(openedComposer());
    choose('Visibility', 'unlisted');

    choose('Post as', BOB.key);

    expect(select('Post as')).toHaveValue(BOB.key);
    expect(screen.getByText('0/20')).toBeInTheDocument();
    expect(select('Visibility')).toHaveValue('unlisted');
    expect(within(select('Visibility')).queryByRole('option', { name: 'local' })).toBeNull();
  });

  it('keeps local when the picked account’s instance serves it too', () => {
    const second = accountOf(WIRED, '3', 'smiling@wired.example');
    renderComposer(
      openedComposer([{ type: 'accounts', accounts: [LAIN, BOB, second], activeKey: LAIN.key }]),
    );
    choose('Visibility', 'local');

    choose('Post as', second.key);

    expect(select('Visibility')).toHaveValue('local');
  });

  it('falls back to the default audience when the picked instance has no local', () => {
    renderComposer(openedComposer());
    choose('Visibility', 'local');

    choose('Post as', BOB.key);

    expect(select('Visibility')).toHaveValue('public');
  });

  it('counts the text against the picked account’s limit', () => {
    renderComposer(openedComposer());
    fireEvent.change(screen.getByRole('textbox', { name: 'Post text' }), {
      target: { value: 'x'.repeat(25) },
    });

    choose('Post as', BOB.key);

    expect(screen.getByText('25/20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeDisabled();
  });

  it('draws a window nobody has with the unknown-instance limit', () => {
    renderComposer(openedComposer(), 'composer:gone:9');

    expect(screen.getByText('0/500')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'compose' })).toBeInTheDocument();
  });
});
