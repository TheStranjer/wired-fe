/**
 * Tests for a post card in a signed-out window (WFE-340, decision 6): its
 * action bar is disabled and says to sign in, and a press runs the line of its
 * command outright — never a prefill or a confirm dialog — so the command's own
 * refusal answers a click, as it answers the typed command and the hotkey.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostActionsProvider } from './PostActionsContext';
import type { PostActions } from './PostActionsContext';
import { PostLine } from './PostLine';
import { AppStateProvider } from '../state/StateContext';
import { ANON_THREAD_ID, anonState } from '../test/anonWindow';
import { status } from '../test/fixtures';

const POST = status('p');

/** Lines as the registry builds them for `a0`, two of which would not run outright. */
const LINES: ReturnType<PostActions['linesFor']> = {
  reply: { line: '/reply a0', prefill: true },
  fav: { line: '/fav a0', prefill: false },
  delete: { line: '/delete a0', prefill: false, confirm: 'delete' },
  quote: { line: '/quote a0', prefill: false },
};

/** Render the card of {@link POST} in the signed-out window; `run` records what the app is asked to run. */
function renderCard(): PostActions['run'] {
  const run = vi.fn<PostActions['run']>();
  const actions: PostActions = { linesFor: () => LINES, run };
  render(
    <PostActionsProvider actions={actions}>
      <AppStateProvider initial={anonState([POST])}>
        <PostLine lineKey="a0" status={POST} windowId={ANON_THREAD_ID} />
      </AppStateProvider>
    </PostActionsProvider>,
  );
  return run;
}

describe('a card in a signed-out window', () => {
  it('has a disabled action bar that says to sign in', () => {
    renderCard();

    const button = screen.getByRole('button', { name: 'Favourite post a0' });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Sign in to use this action');
  });

  it('runs the line of a pressed button outright', () => {
    const run = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Favourite post a0' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/fav a0', prefill: false });
  });

  it('runs a line whose hotkey would prefill outright, not as a prefill', () => {
    const run = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Reply to post a0' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/reply a0', prefill: false });
  });

  it('runs ⋯ as the quote line, with no menu', () => {
    const run = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for post a0' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/quote a0', prefill: false });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
