/**
 * Tests for the confirmation behind a card's `⋯` → Delete and Block (WFE-266):
 * choosing the row opens a dialog and runs nothing; Confirm runs the full line
 * through the app's runner without prefilling; Cancel runs nothing; and a line
 * with no `confirm` mark still runs at once. Mute has its own file.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { choose, renderCard } from './postLineConfirmHarness';
import type { Status } from '../api/schemas/status';
import { status } from '../test/fixtures';

/** A post by the viewer (the harness's account `acct-1`), with `content`. */
function ownPost(content: string): Status {
  return status('own', { content, account: { ...status('x').account, id: 'acct-1' } });
}

/** A post by carol, a remote author. */
const THEIRS: Status = status('theirs', {
  account: { ...status('x').account, id: '9', username: 'carol', acct: 'carol@misskey.test' },
});

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
