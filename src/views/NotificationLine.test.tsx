/**
 * Tests for ./NotificationLine: a mention renders the mentioned post as an
 * ordinary row (a PostRow) with a dim `@` in front of it, while any other kind
 * renders as the `***` client message ./notificationText spells out, on the
 * notification's own clock. Each renders inside AppStateProvider over a
 * notifications window holding that one line, through the real reducer so the
 * buffer's label reaches the sentence.
 */
import { render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import type { StoredAccount } from '../accounts/accountStore';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import { status, TEST_DATE } from '../test/fixtures';
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
  const signed = coreReducer(initialAppState(), {
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

    expect(container.textContent).toMatch(/^\d\d:\d\d \*\*\* @lain@wired\.example mention$/u);
    expect(screen.queryByRole('article')).toBeNull();
  });
});
