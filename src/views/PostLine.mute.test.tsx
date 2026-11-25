/**
 * Tests for the duration dialog behind a card's `⋯` → Mute author (WFE-267):
 * choosing the row opens it with forever chosen and runs nothing; Confirm runs
 * the full line, with the chosen duration word on the end, without prefilling;
 * Cancel runs nothing and the next open starts at forever again.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { choose, renderCard } from './postLineConfirmHarness';
import type { Status } from '../api/schemas/status';
import { status } from '../test/fixtures';

/** A post by carol, a remote author. */
const THEIRS: Status = status('theirs', {
  account: { ...status('x').account, id: '9', username: 'carol', acct: 'carol@misskey.test' },
});

describe('mute from the more-menu', () => {
  it('opens a duration dialog naming the author with forever chosen, and runs nothing yet', () => {
    const run = renderCard(THEIRS);

    choose('Mute author');

    const dialog = screen.getByRole('dialog', { name: 'Mute @carol@misskey.test?' });

    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Forever' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Forever' })).toHaveFocus();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the bare line for forever, without prefilling, and closes', () => {
    const run = renderCard(THEIRS);
    choose('Mute author');

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/mute a0', prefill: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('appends the chosen duration word to the line', () => {
    const run = renderCard(THEIRS);
    choose('Mute author');

    fireEvent.click(screen.getByRole('radio', { name: '1 day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/mute a0 1d', prefill: false });
  });

  it('runs nothing when cancelled, and starts at forever when opened again', () => {
    const run = renderCard(THEIRS);
    choose('Mute author');
    fireEvent.click(screen.getByRole('radio', { name: '7 days' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    choose('Mute author');

    expect(screen.getByRole('radio', { name: 'Forever' })).toBeChecked();
  });
});
