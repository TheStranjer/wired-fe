/**
 * One account's streaming connection as the app holds it (AGENTS.md "Windows,
 * like IRC buffers"): the connection itself, the streams it has joined, and
 * where it stands — not yet up, live, or down with the polling fallback
 * (./pollFallback) running. What it reports is printed once per change in the
 * status window; what it delivers goes through `streamActions` against the
 * newest state and is dispatched.
 */

import { type Scheduler, startPollFallback } from './pollFallback';
import type { Joined } from './streamTopics';
import type { StoredAccount } from '../accounts/accountStore';
import type { ApiSession } from '../api/session';
import type { ConnectStream, StreamConnection, StreamSubscription } from '../api/streamClient';
import { printAction } from '../state/appState';
import type { LineLevel } from '../state/buffer';
import type { RefreshDeps } from '../state/refreshSession';
import { sessionFor } from '../state/selectors';
import { streamActions } from '../state/streamActions';
import { STATUS_WINDOW_ID } from '../windows/model';

/** What a mount may inject: the socket client and the poll clock. */
export type StreamDeps = {
  readonly connect: ConnectStream;
  readonly schedule: Scheduler;
};

/** What every entry shares: the injected deps and the newest state and dispatch. */
export type StreamEnv = {
  readonly deps: StreamDeps;
  readonly refresh: RefreshDeps;
};

/** Where a connection stands: not yet up, up, or down with the fallback polling. */
type Phase = 'connecting' | 'live' | 'down';

/** One account's connection, what it has joined, and its fallback. */
export class StreamEntry implements Joined {
  readonly subs = new Map<string, StreamSubscription>();
  readonly connection: StreamConnection;
  private phase: Phase = 'connecting';
  private stopPolling: (() => void) | null = null;
  private readonly env: StreamEnv;
  private readonly account: StoredAccount;

  constructor(env: StreamEnv, account: StoredAccount) {
    this.env = env;
    this.account = account;
    this.connection = env.deps.connect(this.session(), {
      onEvent: (event) => {
        for (const action of streamActions(env.refresh.getState(), account.key, event)) {
          env.refresh.dispatch(action);
        }
      },
      onStatus: (status) => {
        if (status === 'open') {
          this.opened();
        } else {
          this.failed();
        }
      },
    });
  }

  /** Closes the socket and ends the fallback. */
  close(): void {
    this.endPolling();
    this.connection.close();
  }

  /** The account's session as it is now, so a refreshed token reaches the next reconnect. */
  private session(): () => ApiSession {
    const { account, env } = this;
    return () =>
      sessionFor(env.refresh.getState(), account.key) ?? { origin: account.origin, token: null };
  }

  /** Prints one line in the status window. */
  private say(level: LineLevel, text: string): void {
    this.env.refresh.dispatch(printAction(STATUS_WINDOW_ID, level, text));
  }

  private endPolling(): void {
    this.stopPolling?.();
    this.stopPolling = null;
  }

  /** The stream came up: say so once, and end the fallback if there was one. */
  private opened(): void {
    if (this.phase === 'live') {
      return;
    }
    const text = this.phase === 'down' ? 'restored' : 'live';
    this.phase = 'live';
    this.endPolling();
    this.say('info', `Streaming ${text} for @${this.account.handle}`);
  }

  /** The stream went down: say so once, and start polling. */
  private failed(): void {
    if (this.phase === 'down') {
      return;
    }
    this.phase = 'down';
    this.say('warn', `Streaming unavailable for @${this.account.handle}; polling every minute`);
    const { env } = this;
    this.stopPolling = startPollFallback(env.refresh, this.account.key, env.deps.schedule);
  }
}
