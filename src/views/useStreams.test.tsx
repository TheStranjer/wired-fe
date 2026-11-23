/**
 * Tests for the streaming hook with a fake client: one connection per account,
 * closed when the account goes; the stream plan kept in step with the open
 * windows; and events turned into actions against the newest state. A mount
 * without deps reaches the real client, whose socket is the fake one. The
 * status lines and the fallback are in ./useStreams.status.test.tsx.
 */
import { act } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import type { StreamDeps } from './streamEntry';
import { useStreams } from './useStreams';
import type { AppState } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { FakeSocket } from '../test/fakeSocket';
import { status } from '../test/fixtures';
import { manualScheduler } from '../test/manualScheduler';
import { fakeClient, mount } from '../test/streamHarness';
import { MINE, THEIRS, arriving, offscreen } from '../test/streamWindows';
import { type WindowRef, windowId } from '../windows/model';

const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };
const LOCAL: WindowRef = { kind: 'local', accountKey: MINE, target: null };
const FEDERATED: WindowRef = { kind: 'federated', accountKey: MINE, target: null };
const TAG: WindowRef = { kind: 'hashtag', accountKey: MINE, target: 'lain' };

/** The component that calls the hook under test. */
function Streams(props: { readonly deps?: StreamDeps }): JSX.Element | null {
  useStreams(props.deps);

  return null;
}

/** The fake client and an idle clock as hook deps. */
function fakeDeps(client: ReturnType<typeof fakeClient>): StreamDeps {
  return { connect: client.connect, schedule: manualScheduler().schedule };
}

describe(useStreams, () => {
  it('connects once per account and joins the user stream', () => {
    const client = fakeClient();
    mount(offscreen(), <Streams deps={fakeDeps(client)} />);

    expect(client.connections).toHaveLength(2);
    expect(client.connections[0]?.subscribe).toHaveBeenCalledExactlyOnceWith({ stream: 'user' });
    expect(client.connections[1]?.subscribe).toHaveBeenCalledExactlyOnceWith({ stream: 'user' });
    expect(client.connections[0]?.session()).toStrictEqual({
      origin: 'https://wired.example',
      token: 'x',
    });
  });

  it('keeps the joined streams in step with the open windows', () => {
    const client = fakeClient();
    const { live } = mount(offscreen(HOME), <Streams deps={fakeDeps(client)} />);
    const mine = client.connections[0];
    for (const [view, joined] of [
      [LOCAL, { stream: 'public:local' }],
      [FEDERATED, { stream: 'public' }],
      [TAG, { stream: 'hashtag', tag: 'lain' }],
    ] as const) {
      act(() => {
        live.dispatch({ type: 'windows', action: { type: 'open', ref: view, title: 'w' } });
      });

      expect(mine?.subscribe).toHaveBeenLastCalledWith(joined);

      act(() => {
        live.dispatch({ type: 'windows', action: { type: 'close', id: windowId(view) } });
      });

      expect(mine?.unsubscribe).toHaveBeenLastCalledWith(joined);
    }

    expect(mine?.subscribe).toHaveBeenCalledTimes(4);
    expect(client.connections[1]?.subscribe).toHaveBeenCalledTimes(1);
  });

  it('opens a connection for an account that is added', () => {
    const client = fakeClient();
    const both = offscreen();
    const mineOnly: AppState = { ...both, accounts: both.accounts.slice(0, 1) };
    const { live } = mount(mineOnly, <Streams deps={fakeDeps(client)} />);

    expect(client.connections).toHaveLength(1);

    act(() => {
      live.dispatch({ type: 'accounts', accounts: both.accounts, activeKey: MINE });
    });

    expect(client.connections).toHaveLength(2);
  });

  it('closes the connection of an account that is removed', () => {
    const client = fakeClient();
    const both = offscreen();
    const { live } = mount(both, <Streams deps={fakeDeps(client)} />);
    act(() => {
      live.dispatch({ type: 'accounts', accounts: both.accounts.slice(1), activeKey: THEIRS });
    });

    expect(client.connections[0]?.close).toHaveBeenCalledTimes(1);
    expect(client.connections[1]?.close).not.toHaveBeenCalled();
    expect(client.connections).toHaveLength(2);
  });

  it('turns each event into the actions the newest state asks for', () => {
    const client = fakeClient();
    const { live } = mount(offscreen(HOME), <Streams deps={fakeDeps(client)} />);
    act(() => {
      client.connections[0]?.listener.onEvent(arriving(['user'], status('77')));
    });
    const lines = bufferFor(live.state, windowId(HOME)).lines;

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'post', status: { id: '77' } });

    act(() => {
      client.connections[0]?.listener.onEvent({ kind: 'delete', stream: ['user'], id: '77' });
    });

    expect(bufferFor(live.state, windowId(HOME)).lines).toHaveLength(0);
  });

  it('uses the real client by default, and closes its sockets on unmount', () => {
    const { unmount } = mount(offscreen(), <Streams />);

    expect(FakeSocket.instances.map((socket) => socket.url)).toStrictEqual([
      'wss://wired.example/api/v1/streaming',
      'wss://wired.example/api/v1/streaming',
    ]);
    expect(FakeSocket.instances.map((socket) => socket.protocols)).toStrictEqual([['x'], ['x']]);

    unmount();

    expect(FakeSocket.instances.every((socket) => socket.closed)).toBe(true);
  });
});
