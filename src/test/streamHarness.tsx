/**
 * The scaffolding the streaming hook's tests share (AGENTS.md "Testing"): a
 * fake client that records the connections it was asked for, and a mount that
 * mounts the component under test (the one that calls `useStreams`) over a
 * given app state and keeps the newest state and dispatch where the test can
 * reach them.
 */
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { type Mock, vi } from 'vitest';

import type { ApiSession } from '../api/session';
import type { ConnectStream, StreamListener, StreamSubscription } from '../api/streamClient';
import type { AppState } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** One connection the fake client was asked for. */
export type Fake = {
  readonly session: () => ApiSession;
  readonly listener: StreamListener;
  readonly subscribe: Mock<(subscription: StreamSubscription) => void>;
  readonly unsubscribe: Mock<(subscription: StreamSubscription) => void>;
  readonly close: Mock<() => void>;
};

/** What a test reaches into the mounted app with. */
export type Live = {
  state: AppState;
  dispatch: ReturnType<typeof useAppDispatch>;
};

/** The fake client, recording its connections; {@link onConnect} runs as each one opens. */
export function fakeClient(onConnect?: (listener: StreamListener) => void): {
  readonly connect: ConnectStream;
  readonly connections: Fake[];
} {
  const connections: Fake[] = [];
  const connect: ConnectStream = (session, listener) => {
    const fake: Fake = {
      session,
      listener,
      subscribe: vi.fn<(subscription: StreamSubscription) => void>(),
      unsubscribe: vi.fn<(subscription: StreamSubscription) => void>(),
      close: vi.fn<() => void>(),
    };
    connections.push(fake);
    onConnect?.(listener);
    return { subscribe: fake.subscribe, unsubscribe: fake.unsubscribe, close: fake.close };
  };
  return { connect, connections };
}

/**
 * Mounts {@link under} over {@link initial}; `live` always holds the newest
 * state and dispatch.
 */
export function mount(initial: AppState, under: ReactNode): { live: Live; unmount: () => void } {
  const live: Live = { state: initial, dispatch: () => undefined };
  function Probe(): JSX.Element | null {
    live.state = useAppState();
    live.dispatch = useAppDispatch();
    return null;
  }
  const view = render(
    <AppStateProvider initial={initial}>
      <Probe />
      {under}
    </AppStateProvider>,
  );
  return { live, unmount: view.unmount };
}

/** The texts printed in the status window, each with its level. */
export function statusLines(state: AppState): readonly string[] {
  return bufferFor(state, STATUS_WINDOW_ID).lines.flatMap((line) =>
    line.kind === 'system' ? [`${line.level}: ${line.text}`] : [],
  );
}
