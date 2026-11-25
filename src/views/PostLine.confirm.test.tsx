/**
 * Tests for the confirmation behind a card's `⋯` → Delete and Block (WFE-266):
 * choosing the row opens a dialog and runs nothing; Confirm runs the full line
 * through the app's runner without prefilling; Cancel runs nothing; and a line
 * with no `confirm` mark still runs at once.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostActionsProvider } from './PostActionsContext';
import type { PostActions } from './PostActionsContext';
import { PostLine } from './PostLine';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the home window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** Lines for the rows under test, as the registry would build them for `a0`. */
const LINES: ReturnType<PostActions['linesFor']> = {
  delete: { line: '/delete a0', prefill: false, confirm: 'delete' },
  block: { line: '/block a0', prefill: false, confirm: 'block' },
  quote: { line: '/quote a0', prefill: false },
};

/** A post by the viewer, with `content`. */
function ownPost(content: string): Status {
  return status('own', { content, account: { ...status('x').account, id: 'acct-1' } });
}

/** A post by carol, a remote author. */
const THEIRS: Status = status('theirs', {
  account: { ...status('x').account, id: '9', username: 'carol', acct: 'carol@misskey.test' },
});

/** The home window holding just {@link post}, which gets the label `a0`. */
function seeded(post: Status): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, { type: 'statuses', windowId: HOME, statuses: [post], where: 'newer' });
}

/** Render one card for {@link post}; the returned `run` records what the app is asked to run. */
function renderCard(post: Status): PostActions['run'] {
  const run = vi.fn<PostActions['run']>();
  const actions: PostActions = { linesFor: () => LINES, run };
  render(
    <PostActionsProvider actions={actions}>
      <AppStateProvider initial={seeded(post)}>
        <PostLine lineKey="a0" status={post} windowId={HOME} />
      </AppStateProvider>
    </PostActionsProvider>,
  );
  return run;
}

/** Open the card's `⋯` menu and choose the row named {@link row}. */
function choose(row: string): void {
  fireEvent.click(screen.getByRole('button', { name: /^More actions for post / }));
  fireEvent.click(screen.getByRole('menuitem', { name: row }));
}

describe('delete from the more-menu', () => {
  it('opens a dialog naming the post and its words, and runs nothing yet', () => {
    const run = renderCard(ownPost('<p>goodbye wired</p>'));

    choose('Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete post [a0]?' });

    expect(dialog).toHaveTextContent('This can\'t be undone. "goodbye wired"');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the full line without prefilling when confirmed, and closes', () => {
    const run = renderCard(ownPost('<p>goodbye wired</p>'));
    choose('Delete');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/delete a0', prefill: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs nothing when cancelled, and closes', () => {
    const run = renderCard(ownPost('<p>goodbye wired</p>'));
    choose('Delete');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cuts a long post to an 80-character excerpt', () => {
    renderCard(ownPost(`<p>${'x'.repeat(100)}</p>`));

    choose('Delete');

    expect(screen.getByRole('dialog')).toHaveTextContent(`"${'x'.repeat(80)}…"`);
  });

  it('shows no excerpt for a post with no words', () => {
    renderCard(ownPost('<p></p>'));

    choose('Delete');

    const dialog = screen.getByRole('dialog', { name: 'Delete post [a0]?' });

    expect(dialog).toHaveTextContent("This can't be undone.");
    expect(dialog).not.toHaveTextContent('"');
  });
});

describe('block from the more-menu', () => {
  it('opens a dialog naming the author, and runs nothing yet', () => {
    const run = renderCard(THEIRS);

    choose('Block author');

    const dialog = screen.getByRole('dialog', { name: 'Block @carol@misskey.test?' });

    expect(dialog).toHaveTextContent('their posts are hidden');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the full line without prefilling when confirmed', () => {
    const run = renderCard(THEIRS);
    choose('Block author');

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/block a0', prefill: false });
  });

  it('runs nothing when cancelled', () => {
    const run = renderCard(THEIRS);
    choose('Block author');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('a row without a confirmation', () => {
  it('runs its line at once, with no dialog', () => {
    const run = renderCard(THEIRS);

    choose('Quote');

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/quote a0', prefill: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
