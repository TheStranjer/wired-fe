/**
 * Tests for feed windows on the streaming hook with a fake client: the feed
 * joins its sources' streams on the connections the accounts already have and
 * opens none of its own, a second window over the same account adds no
 * connection, a post arriving on two accounts' streams shows once, and an edit
 * and a delete reach the feed's lines.
 */
import { act } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import type { StreamDeps } from './streamEntry';
import { useStreams } from './useStreams';
import { coreReducer } from '../state/appState';
import { bufferFor } from '../state/selectors';
import { A_HOME, B_HOME, post } from '../test/feedHost';
import { A_ACCOUNT, B_ACCOUNT, feedState, feedWindowId, readLines } from '../test/feedWindow';
import { manualScheduler } from '../test/manualScheduler';
import { fakeClient, mount } from '../test/streamHarness';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The component that calls the hook under test. */
function Streams(props: { readonly deps: StreamDeps }): JSX.Element | null {
  useStreams(props.deps);

  return null;
}

/** A feed over lain's home and local timelines and navi's home, and a second one over lain's local. */
const FEEDS = [
  {
    id: 'f1',
    name: 'main',
    sources: [A_HOME, { accountKey: A_ACCOUNT.key, source: 'local' as const }, B_HOME],
  },
  { id: 'f2', name: 'side', sources: [{ accountKey: A_ACCOUNT.key, source: 'local' as const }] },
];

/** The feed window mounted under the hook, with the status window on screen, and its fake client. */
function mounted(): ReturnType<typeof mount> & { readonly client: ReturnType<typeof fakeClient> } {
  const client = fakeClient();
  const deps = { connect: client.connect, schedule: manualScheduler().schedule };
  const state = coreReducer(feedState(FEEDS), {
    type: 'windows',
    action: { type: 'activate', id: STATUS_WINDOW_ID },
  });

  return { ...mount(state, <Streams deps={deps} />), client };
}

describe('feed windows and the streaming hook', () => {
  it('joins each source on its own account’s connection and opens none of its own', () => {
    const { client, live } = mounted();

    expect(client.connections).toHaveLength(2);
    expect(client.connections[0]?.subscribe.mock.calls).toStrictEqual([
      [{ stream: 'user' }],
      [{ stream: 'public:local' }],
    ]);
    expect(client.connections[1]?.subscribe.mock.calls).toStrictEqual([[{ stream: 'user' }]]);

    act(() => {
      live.dispatch({
        type: 'windows',
        action: {
          type: 'open',
          ref: { kind: 'feed', accountKey: null, target: 'f2' },
          title: '~side',
        },
      });
    });

    expect(client.connections).toHaveLength(2);
    expect(client.connections[0]?.subscribe).toHaveBeenCalledTimes(2);
  });

  it('shows a post once when it arrives on two accounts’ streams, and counts it unread', () => {
    const { client, live } = mounted();
    const wire = post('1', 1);
    for (const connection of client.connections) {
      act(() => {
        connection.listener.onEvent({ kind: 'update', stream: ['user'], status: wire });
      });
    }
    const window = feedWindowId('f1');

    expect(readLines(bufferFor(live.state, window))).toBe(`1@${A_ACCOUNT.key}`);
    expect(bufferFor(live.state, window).feed?.items[0]?.seenBy).toStrictEqual([
      A_ACCOUNT.key,
      B_ACCOUNT.key,
    ]);
    expect(live.state.windows.windows.find((win) => win.id === window)?.unread).toBe(1);
  });

  it('applies an edit and a delete to the feed’s lines', () => {
    const { client, live } = mounted();
    const window = feedWindowId('f1');
    act(() => {
      client.connections[0]?.listener.onEvent({
        kind: 'update',
        stream: ['public:local'],
        status: post('2', 2),
      });
    });
    const edited = post('2', 2, { content: '<p>edited</p>' });
    act(() => {
      client.connections[1]?.listener.onEvent({ kind: 'statusUpdate', stream: [], status: edited });
    });

    expect(bufferFor(live.state, window).lines[0]).toMatchObject({ status: edited });

    act(() => {
      client.connections[0]?.listener.onEvent({ kind: 'delete', stream: [], id: '2' });
    });

    expect(readLines(bufferFor(live.state, window))).toBe('');
  });
});
