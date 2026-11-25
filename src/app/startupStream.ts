/**
 * The stream feed at startup (WFE-243, decision 14): what the boot does about
 * the default `stream` feed. An account that signed in through the redirect
 * joins an automatic stream, or earns the `/feed add` hint when the reader has
 * edited it; and with no saved desk the first run makes the stream and shows it
 * alone — no per-account home windows — while a session whose stream is still
 * automatic shows it again. The decisions are ./state/streamFeed's, the same
 * ones the running session's `signedIn` action makes; this only dispatches them.
 */

import type { StoredAccount } from '../accounts/accountStore';
import { feedWindowOpen } from '../state/feedWindow';
import type { Settings } from '../state/settings';
import { openStartupWindows } from '../state/startupWindows';
import type { Dispatch } from '../state/StateContext';
import { joinStream, startupStream } from '../state/streamFeed';
import { STATUS_WINDOW_ID } from '../windows/model';

/** What this step needs of startup's dependencies. */
export type StreamDeps = {
  readonly dispatch: Dispatch;
  readonly now: () => Date;
};

/**
 * {@link settings} after {@link joined}, the account a login redirect just
 * signed in (null when there was none), joined the stream: the feeds saved,
 * and the hint printed in the status window when the stream was edited.
 */
export function joinStreamAtStartup(
  deps: StreamDeps,
  settings: Settings,
  joined: StoredAccount | null,
): Settings {
  if (joined === null) {
    return settings;
  }
  const join = joinStream(settings.feeds, joined);
  if (join.feeds !== settings.feeds) {
    deps.dispatch({ type: 'settings', settings: { feeds: join.feeds } });
  }
  if (join.hint !== null) {
    deps.dispatch({
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: deps.now(),
      level: 'info',
      text: join.hint,
    });
  }
  return { ...settings, feeds: join.feeds };
}

/** What a session's default windows depend on: the settings and who is signed in. */
export type SessionFacts = {
  readonly settings: Settings;
  readonly accounts: readonly StoredAccount[];
  readonly activeKey: string | null;
};

/**
 * Open the windows a session with no saved desk starts with: the stream feed
 * when there is one to show (making it first on the first run), else a home and
 * a notifications window per account.
 */
export function openDefaultWindows(deps: StreamDeps, facts: SessionFacts): void {
  const { accounts, activeKey } = facts;
  const stream = startupStream(facts.settings, accounts);
  if (stream.patch !== null) {
    deps.dispatch({ type: 'settings', settings: stream.patch });
  }
  const actions =
    stream.open === null ? openStartupWindows(accounts, activeKey) : [feedWindowOpen(stream.open)];
  for (const action of actions) {
    deps.dispatch({ type: 'windows', action });
  }
}
