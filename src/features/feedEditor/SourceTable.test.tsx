/**
 * Tests for the feed editor's table of sources (decision 14): a checkbox for
 * every account and kind of source named "<kind> of @<handle>", ticked as the
 * draft reads them, toggling reports the source, and the sources of an account
 * that cannot be read are disabled with the reason in their name — unless the
 * feed already reads them, which can always be unticked.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { draftOf } from './editorDraft';
import { ALICE, LAIN, MAIN } from './editorSession';
import { SourceTable } from './SourceTable';

/** The table over both accounts for the draft of {@link MAIN}, with {@link expired} accounts. */
function renderTable(expired: ReadonlySet<string>): ReturnType<typeof vi.fn> {
  const onToggle = vi.fn();
  render(
    <SourceTable
      accounts={[LAIN, ALICE]}
      expired={expired}
      draft={draftOf(MAIN)}
      onToggle={onToggle}
    />,
  );
  return onToggle;
}

describe(SourceTable, () => {
  it('has a row per account and a column per kind of source', () => {
    renderTable(new Set());

    const table = screen.getByRole('table', { name: 'Sources by account' });

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toStrictEqual(['account', 'home', 'mentions', 'dms', 'notifications', 'local', 'federated']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toStrictEqual(['@lain@wired.example', '@alice@wired.example']);
    expect(within(table).getAllByRole('checkbox')).toHaveLength(12);
  });

  it('ticks the sources the draft reads, and only those', () => {
    renderTable(new Set());

    expect(screen.getByRole('checkbox', { name: 'home of @lain@wired.example' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'home of @alice@wired.example' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'mentions of @lain@wired.example' }),
    ).not.toBeChecked();
  });

  it('reports the source of the cell that was toggled', () => {
    const onToggle = renderTable(new Set());

    fireEvent.click(screen.getByRole('checkbox', { name: 'dms of @alice@wired.example' }));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith({ accountKey: ALICE.key, source: 'dms' });
  });

  it('disables the sources of an account that cannot be read, saying why', () => {
    renderTable(new Set([LAIN.key]));

    const blocked = screen.getByRole('checkbox', {
      name: 'mentions of @lain@wired.example (sign-in expired)',
    });

    expect(blocked).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'mentions of @alice@wired.example' }),
    ).toBeEnabled();
  });

  it('keeps a source the feed already reads enabled, so it can be unticked', () => {
    const onToggle = renderTable(new Set([LAIN.key]));

    const read = screen.getByRole('checkbox', {
      name: 'home of @lain@wired.example (sign-in expired)',
    });
    fireEvent.click(read);

    expect(read).toBeEnabled();
    expect(onToggle).toHaveBeenCalledExactlyOnceWith({ accountKey: LAIN.key, source: 'home' });
  });
});
