/**
 * The hook behind the shell's account picker (WFE-282): nothing while no
 * question is open or another modal holds the keyboard, otherwise the `Post as`
 * dialog for the window asked about. OK saves the choice through the same
 * settings transition `/postas <handle>` uses (the feed's default for `For this
 * feed`, the global one for `Everywhere`) and prints its confirmation; Cancel
 * and Escape change nothing. A window that is no feed offers no feed scope.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useAccountPicker } from './useAccountPicker';
import type { FeedSpec } from '../state/feeds';
import { feedWindowOpen } from '../state/feedWindow';
import type { AppAction } from '../state/reducer';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import { ALICE, LAIN } from '../test/splitDesk';
import { STATUS_WINDOW_ID } from '../windows/model';

const FEED: FeedSpec = { id: 'f1', name: 'main', sources: [] };
const FEED_ID = 'feed:-:f1';

const SIGNED_IN: readonly AppAction[] = [
  { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key },
  { type: 'settings', settings: { feeds: [FEED] } },
];

/** Opens the picker on {@link windowId}. */
function ask(windowId: string): AppAction {
  return { type: 'openAccountPick', pick: { purpose: 'default', windowId } };
}

/** What the state holds that the picker may change, as text. */
function Outcome(): JSX.Element {
  const state = useAppState();
  const lines = [...state.buffers.values()].flatMap((buffer) =>
    buffer.lines.flatMap((line) => (line.kind === 'system' ? [line.text] : [])),
  );
  const open = String(state.accountPick !== null);
  const feed = state.settings.feeds[0]?.postAs ?? 'none';
  return (
    <output aria-label="outcome">{`open=${open} global=${state.settings.postAs ?? 'none'} feed=${feed} lines=${lines.join('|')}`}</output>
  );
}

/** Mounts the hook, renders what it hands back and the outcome. */
function Host(props: { readonly blocked: boolean }): JSX.Element {
  const picker = useAccountPicker(props.blocked, () => false);
  return (
    <>
      {picker}
      <Outcome />
    </>
  );
}

/** Render the host over a session moved along by {@link actions}. */
function renderHost(actions: readonly AppAction[], blocked = false): void {
  render(
    <AppStateProvider initial={stateAfter(actions)}>
      <Host blocked={blocked} />
    </AppStateProvider>,
  );
}

/** The outcome text. */
function outcome(): string | null {
  return screen.getByLabelText('outcome').textContent;
}

describe(useAccountPicker, () => {
  it('shows nothing while no question is open', () => {
    renderHost(SIGNED_IN);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('waits while another modal is open, leaving the question open', () => {
    renderHost([...SIGNED_IN, ask(STATUS_WINDOW_ID)], true);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outcome()).toContain('open=true');
  });

  it('shows nothing for a window that is gone', () => {
    renderHost([...SIGNED_IN, ask('nowhere')]);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows nothing when nobody is signed in', () => {
    renderHost([ask(STATUS_WINDOW_ID)]);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows nothing for a draft of a gone window', () => {
    const pick = { purpose: 'post', windowId: 'nowhere', draft: { text: 'hi' } } as const;

    renderHost([...SIGNED_IN, { type: 'openAccountPick', pick }]);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows nothing for a draft with nobody signed in', () => {
    const pick = { purpose: 'post', windowId: STATUS_WINDOW_ID, draft: { text: 'hi' } } as const;

    renderHost([{ type: 'openAccountPick', pick }]);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks about a feed window: both scopes, the feed one chosen, the current state described', () => {
    renderHost([
      ...SIGNED_IN,
      { type: 'settings', settings: { feeds: [{ ...FEED, postAs: ALICE.key }] } },
      { type: 'windows', action: feedWindowOpen(FEED) },
      ask(FEED_ID),
    ]);

    expect(screen.getByRole('dialog', { name: 'Post as' })).toHaveAccessibleDescription(
      '~main posts as @alice@wired.example (feed default)',
    );
    expect(screen.getByRole('radio', { name: '1. @lain@wired.example' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2. @alice@wired.example' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'For this feed (~main)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Everywhere' })).not.toBeChecked();
  });

  it('starts on the active account when nothing is set, and says so', () => {
    renderHost([...SIGNED_IN, ask(STATUS_WINDOW_ID)]);

    expect(screen.getByRole('dialog', { name: 'Post as' })).toHaveAccessibleDescription(
      'No posting account set',
    );
    expect(screen.getByRole('radio', { name: '1. @lain@wired.example' })).toBeChecked();
  });

  it('starts on the first account when none is active', () => {
    renderHost([
      { type: 'accounts', accounts: [LAIN, ALICE], activeKey: null },
      ask(STATUS_WINDOW_ID),
    ]);

    expect(screen.getByRole('radio', { name: '1. @lain@wired.example' })).toBeChecked();
  });

  it('offers only Everywhere, chosen, for a window that is no feed', () => {
    renderHost([...SIGNED_IN, ask(STATUS_WINDOW_ID)]);

    expect(screen.queryByRole('radio', { name: /For this feed/u })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Everywhere' })).toBeChecked();
  });

  it('offers only Everywhere for a feed window whose feed is gone', () => {
    renderHost([
      ...SIGNED_IN,
      { type: 'windows', action: feedWindowOpen({ ...FEED, id: 'f9' }) },
      ask('feed:-:f9'),
    ]);

    expect(screen.queryByRole('radio', { name: /For this feed/u })).toBeNull();
  });

  it('offers only Everywhere for a feed window that names no feed', () => {
    renderHost([
      ...SIGNED_IN,
      {
        type: 'windows',
        action: { type: 'open', ref: { kind: 'feed', accountKey: null, target: null }, title: '~' },
      },
      ask('feed:-:-'),
    ]);

    expect(screen.queryByRole('radio', { name: /For this feed/u })).toBeNull();
  });

  it('saves the account as the feed default on OK with For this feed, and confirms', () => {
    renderHost([...SIGNED_IN, { type: 'windows', action: feedWindowOpen(FEED) }, ask(FEED_ID)]);

    fireEvent.click(screen.getByRole('radio', { name: '2. @alice@wired.example' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(outcome()).toBe(
      `open=false global=none feed=${ALICE.key} lines=~main posts as @alice@wired.example (feed default)`,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves the account as the global default on OK with Everywhere, and confirms', () => {
    renderHost([...SIGNED_IN, { type: 'windows', action: feedWindowOpen(FEED) }, ask(FEED_ID)]);

    fireEvent.click(screen.getByRole('radio', { name: 'Everywhere' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(outcome()).toBe(
      `open=false global=${LAIN.key} feed=none lines=posts as @lain@wired.example (global default)`,
    );
  });

  it('changes nothing on Cancel', () => {
    renderHost([...SIGNED_IN, ask(STATUS_WINDOW_ID)]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(outcome()).toBe('open=false global=none feed=none lines=');
  });

  it('closes on Escape', () => {
    renderHost([...SIGNED_IN, ask(STATUS_WINDOW_ID)]);

    fireEvent.keyDown(screen.getByRole('radio', { name: '1. @lain@wired.example' }), {
      key: 'Escape',
    });

    expect(outcome()).toBe('open=false global=none feed=none lines=');
  });
});
