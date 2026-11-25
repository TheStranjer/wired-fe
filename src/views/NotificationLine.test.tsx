/**
 * Tests for ./NotificationLine: a mention renders the mentioned post as an
 * ordinary row (a PostRow) with a dim `@` in front of it, while any other kind
 * renders as the `***` client message ./notificationText spells out, on the
 * notification's own clock — led, since WFE-106, by the actor's handle as a
 * click target that opens their profile window, unless the sentence names no
 * actor. Each renders inside AppStateProvider over a notifications window
 * holding that one line, through the real reducer so the buffer's label reaches
 * the sentence and a click's window ask reaches the window list.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import type { StoredAccount } from '../accounts/accountStore';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { status, TEST_DATE } from '../test/fixtures';
import { LINE_SETTINGS } from '../test/lineSettings';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the notifications window belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The notifications window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'notifications', accountKey: ACCOUNT_KEY, target: null };
const NOTES = windowId(REF);

/** A notification, its kind from the raw type, over an authored status. */
function note(type: string, shown: ReturnType<typeof status> | null): Notification {
  return v.parse(NotificationSchema, {
    id: 'n1',
    type,
    created_at: TEST_DATE,
    account: status('author').account,
    status: shown,
  });
}

/** The state whose notifications buffer holds one {@link shown} line. */
function seeded(shown: Notification): AppState {
  const signed = coreReducer(initialAppState(LINE_SETTINGS), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'notifications' },
  });
  return appReducer(opened, {
    type: 'notifications',
    windowId: NOTES,
    notifications: [shown],
    where: 'newer',
  });
}

/** The window's one notification line; the setup fails without one. */
function lineOf(state: AppState): NotificationLineData {
  const line = bufferFor(state, NOTES).lines.find(
    (entry): entry is NotificationLineData => entry.kind === 'notification',
  );
  if (line === undefined) {
    throw new Error('the notifications buffer holds no notification line');
  }
  return line;
}

/** Render the window's notification line over {@link state}. */
function renderLine(state: AppState) {
  return render(
    <AppStateProvider initial={state}>
      <NotificationLine line={lineOf(state)} windowId={NOTES} />
    </AppStateProvider>,
  );
}

/** The titles of every window the state holds, one span per window. */
function WindowTitles(): JSX.Element {
  const state = useAppState();
  return (
    <section aria-label="windows">
      {state.windows.windows.map((win) => (
        <span key={win.id}>{win.title}</span>
      ))}
    </section>
  );
}

describe(NotificationLine, () => {
  it('shows a mention as the post itself, in a row the window labelled', () => {
    const { container } = renderLine(seeded(note('mention', status('a'))));

    expect(
      screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' }),
    ).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('@');
  });

  it('marks a mention with a dim @ beside the post', () => {
    const { container } = renderLine(seeded(note('mention', status('a'))));

    expect(container.textContent).toMatch(/^@/u);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('renders a favourite as the *** sentence, with the label and the excerpt', () => {
    const favourited = status('q', { content: '<p>present day, present time</p>' });

    const { container } = renderLine(seeded(note('favourite', favourited)));

    expect(container.textContent).toMatch(
      /^\d\d:\d\d \*\*\* @lain@wired\.example favourited \[a0\] "present day, present time"$/u,
    );
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('follows the clock format the reader has set', () => {
    const state = appReducer(seeded(note('follow', null)), {
      type: 'settings',
      settings: { clockFormat: '12h' },
    });

    const { container } = renderLine(state);

    expect(container.textContent).toMatch(
      /^\d{1,2}:\d\d[ap]m \*\*\* @lain@wired\.example followed you$/u,
    );
  });

  it('falls back to a client message for a mention with no status', () => {
    const { container } = renderLine(seeded(note('mention', null)));

    expect(container.textContent).toMatch(/^\d\d:\d\d \*\*\* @lain@wired\.example mentioned you$/u);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows a mention whose post has no text as a sentence with its label', () => {
    const { container } = renderLine(seeded(note('mention', status('e', { content: '' }))));

    expect(container.textContent).toMatch(
      /^\d\d:\d\d \*\*\* @lain@wired\.example mentioned you \[a0\] \(no text\)$/u,
    );
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows a quote as its sentence over the quoting post', () => {
    const quoting = status('q', { content: '<p>look at this</p>' });

    const { container } = renderLine(seeded(note('quote', quoting)));

    expect(container.textContent).toContain('@lain@wired.example quoted [a0] "look at this"');
    expect(screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' })).toBeVisible();
  });

  it('shows a quote with no status as its sentence alone', () => {
    const { container } = renderLine(seeded(note('quote', null)));

    expect(container.textContent).toMatch(/^\d\d:\d\d \*\*\* @lain@wired\.example quoted$/u);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('leads a follow line with the actor handle and opens their profile when clicked', () => {
    const state = seeded(note('follow', null));
    render(
      <AppStateProvider initial={state}>
        <NotificationLine line={lineOf(state)} windowId={NOTES} />
        <WindowTitles />
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '@lain@wired.example' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent(
      '@lain@wired.example',
    );
  });

  it('keeps a sentence plain when it names no actor', () => {
    const { container } = renderLine(seeded(note('poll', status('p'))));

    expect(container.textContent).toMatch(/^\d\d:\d\d \*\*\* a poll you voted in ended \[a0\]$/u);
    expect(container.querySelector('button')).toBeNull();
  });
});
