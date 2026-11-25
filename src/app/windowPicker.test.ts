/**
 * Tests for the window picker of the pane menus (WFE-270): which windows are
 * listed and how each reads, and the line a chosen row runs.
 */
import { describe, expect, it } from 'vitest';

import { pickedWindowLine, windowPickerItems } from './windowPicker';
import type { AppState } from '../state/appState';
import { twoPanes } from '../test/phantomPanes';

/** An account signed in as {@link handle}. */
function account(handle: string): AppState['accounts'][number] {
  return {
    key: `https://x.example#${handle}`,
    origin: 'https://x.example',
    accountId: handle,
    handle,
    token: 'secret',
    refreshToken: null,
    expiresAt: null,
  };
}

/** The windows of {@link twoPanes}, the third owned by {@link owner}, with {@link accounts} signed in. */
function stateWith(accounts: readonly string[], owner: string | null): AppState {
  const base = twoPanes();
  const windows = base.windows.windows.map((win, index) =>
    index === 2 ? { ...win, ref: { ...win.ref, accountKey: owner } } : win,
  );
  return { ...base, windows: { ...base.windows, windows }, accounts: accounts.map(account) };
}

describe(windowPickerItems, () => {
  it('gives number and title for every window but the pane’s own', () => {
    const items = windowPickerItems(stateWith([], null), 'phantom:-:a');

    expect(items.map((item) => item.label)).toStrictEqual(['1 · status', '3 · phantom/b']);
  });

  it('adds the account of a window while several accounts are signed in', () => {
    const items = windowPickerItems(
      stateWith(['a@x', 'b@x'], 'https://x.example#b@x'),
      'phantom:-:a',
    );

    expect(items.map((item) => item.label)).toStrictEqual(['1 · status', '3 · phantom/b · @b@x']);
  });

  it('leaves the account out with only one signed in', () => {
    const items = windowPickerItems(stateWith(['a@x'], 'https://x.example#a@x'), 'phantom:-:a');

    expect(items.map((item) => item.label)).toStrictEqual(['1 · status', '3 · phantom/b']);
  });
});

describe(pickedWindowLine, () => {
  it('is the command with win and the number for a window row', () => {
    expect(pickedWindowLine('win:3', 'float')).toBe('/float win 3');
  });

  it('is null for any other row', () => {
    expect(pickedWindowLine('home', 'vsplit')).toBeNull();
  });
});
