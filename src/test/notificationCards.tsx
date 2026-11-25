/**
 * Shared setup for the notification-card tests: a signed-in account with a
 * notifications window holding one notification line, rendered through the
 * real reducer with the window list shown beside it so a click's window ask
 * can be read back.
 */
import { render, type RenderResult } from '@testing-library/react';
import type { ComponentType, JSX } from 'react';
import * as v from 'valibot';

import { status, TEST_DATE } from './fixtures';
import { PlacementProbe } from './placementProbe';
import type { StoredAccount } from '../accounts/accountStore';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { NotificationLineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { AppStateProvider, useAppState } from '../state/StateContext';
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

/** The notifications window on the account, and the id its ref names. */
const REF: WindowRef = { kind: 'notifications', accountKey: ACCOUNT_KEY, target: null };
const NOTES = windowId(REF);

/** A notification of the raw `type` over an authored status, with extra wire fields. */
export function note(
  type: string,
  post: ReturnType<typeof status> | null,
  extra: Record<string, unknown> = {},
): Notification {
  return v.parse(NotificationSchema, {
    id: 'n1',
    type,
    created_at: TEST_DATE,
    account: status('author').account,
    status: post,
    ...extra,
  });
}

/** The state whose notifications buffer holds the one line, under `settings`. */
export function seeded(one: Notification, settings: Settings = DEFAULT_SETTINGS): AppState {
  const signed = coreReducer(initialAppState(settings), {
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
    notifications: [one],
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

/** What a notification line component takes: its window and the line. */
type LineComponent = ComponentType<{
  readonly windowId: string;
  readonly line: NotificationLineData;
}>;

/** Render `Line` for the line shown in window `id` over {@link state}, with the window list beside it. */
export function renderLine(Line: LineComponent, state: AppState, id: string = NOTES): RenderResult {
  return render(
    <AppStateProvider initial={state}>
      <Line line={lineOf(state)} windowId={id} />
      <WindowTitles />
      <PlacementProbe />
    </AppStateProvider>,
  );
}

/** What the notification line itself shows, without the window list. */
export function lineText(container: HTMLElement): string {
  return container.firstElementChild?.textContent ?? '';
}
