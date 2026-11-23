/**
 * Tests for the streaming client over the fake socket: the URL and its token,
 * subscribe and unsubscribe frames (before and after the socket opens), decoded
 * events, and the reconnect — a drop reports failed once, retries with a
 * doubling delay, re-joins what is wanted and reports open again; closing
 * ends all of it. Timers are fake: nothing waits on real time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectStream } from './streamClient';
import type { StreamListener, StreamStatus } from './streamClient';
import type { StreamEvent } from './streaming';
import { FakeSocket } from '../test/fakeSocket';

const SESSION = { origin: 'https://wired.example', token: 'tok en' };

/** A listener that records everything it is told. */
function recorder(): StreamListener & {
  readonly events: StreamEvent[];
  readonly statuses: StreamStatus[];
} {
  const events: StreamEvent[] = [];
  const statuses: StreamStatus[] = [];

  return {
    events,
    statuses,
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
  };
}

/** The newest socket the client opened. */
function newest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (socket === undefined) {
    throw new Error('no socket was opened');
  }

  return socket;
}

/** The frames the newest socket was sent, parsed. */
function sentFrames(): readonly unknown[] {
  return newest().sent.map((text) => JSON.parse(text) as unknown);
}

describe(connectStream, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens wss with the token in the query', () => {
    connectStream(() => SESSION, recorder());

    expect(newest().url).toBe('wss://wired.example/api/v1/streaming?access_token=tok+en');
  });

  it('opens ws without a token for an http origin', () => {
    connectStream(() => ({ origin: 'http://localhost:4000', token: null }), recorder());

    expect(newest().url).toBe('ws://localhost:4000/api/v1/streaming');
  });

  it('reports open and joins what was subscribed before the socket opened', () => {
    const listener = recorder();
    const connection = connectStream(() => SESSION, listener);
    connection.subscribe({ stream: 'user' });
    connection.subscribe({ stream: 'hashtag', tag: 'lain' });

    expect(newest().sent).toStrictEqual([]);

    newest().open();

    expect(listener.statuses).toStrictEqual(['open']);
    expect(sentFrames()).toStrictEqual([
      { type: 'subscribe', stream: 'user' },
      { type: 'subscribe', stream: 'hashtag', tag: 'lain' },
    ]);
  });

  it('sends subscribe and unsubscribe frames at once once open', () => {
    const connection = connectStream(() => SESSION, recorder());
    newest().open();
    connection.subscribe({ stream: 'public' });
    connection.unsubscribe({ stream: 'public' });

    expect(sentFrames()).toStrictEqual([
      { type: 'subscribe', stream: 'public' },
      { type: 'unsubscribe', stream: 'public' },
    ]);
  });

  it('does not join a stream that was unsubscribed before the socket opened', () => {
    const connection = connectStream(() => SESSION, recorder());
    connection.subscribe({ stream: 'public' });
    connection.unsubscribe({ stream: 'public' });
    newest().open();

    expect(newest().sent).toStrictEqual([]);
  });

  it('hands decoded events to the listener and ignores the rest', () => {
    const listener = recorder();
    connectStream(() => SESSION, listener);
    newest().open();
    newest().message(JSON.stringify({ stream: ['user'], event: 'delete', payload: '5' }));
    newest().message('garbage');
    newest().message(new ArrayBuffer(1));

    expect(listener.events).toStrictEqual([{ kind: 'delete', stream: ['user'], id: '5' }]);
  });

  it('reports failed once per drop, even though the browser says error and close', () => {
    const listener = recorder();
    connectStream(() => SESSION, listener);
    newest().drop();

    expect(listener.statuses).toStrictEqual(['failed']);
  });

  it('retries with a doubling delay', () => {
    connectStream(() => SESSION, recorder());
    newest().drop();
    vi.advanceTimersByTime(999);

    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);

    expect(FakeSocket.instances).toHaveLength(2);

    newest().drop();
    vi.advanceTimersByTime(1999);

    expect(FakeSocket.instances).toHaveLength(2);

    vi.advanceTimersByTime(1);

    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('caps the retry delay', () => {
    connectStream(() => SESSION, recorder());
    for (let attempt = 0; attempt < 8; attempt += 1) {
      newest().drop();
      vi.advanceTimersByTime(30_000);
    }

    expect(FakeSocket.instances).toHaveLength(9);
  });

  it('re-joins every wanted stream when the retry opens, and starts the delay over', () => {
    const listener = recorder();
    const connection = connectStream(() => SESSION, listener);
    connection.subscribe({ stream: 'user' });
    newest().open();
    newest().drop();
    vi.advanceTimersByTime(1000);
    newest().open();

    expect(sentFrames()).toStrictEqual([{ type: 'subscribe', stream: 'user' }]);
    expect(listener.statuses).toStrictEqual(['open', 'failed', 'open']);

    newest().drop();
    vi.advanceTimersByTime(1000);

    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('reads the session afresh for each attempt', () => {
    let token = 'old';
    connectStream(() => ({ origin: SESSION.origin, token }), recorder());
    token = 'new';
    newest().drop();
    vi.advanceTimersByTime(1000);

    expect(newest().url).toContain('access_token=new');
  });

  it('closes the socket and reports nothing more', () => {
    const listener = recorder();
    const connection = connectStream(() => SESSION, listener);
    const socket = newest();
    socket.open();
    connection.close();
    socket.drop();
    vi.advanceTimersByTime(60_000);

    expect(socket.closed).toBe(true);
    expect(listener.statuses).toStrictEqual(['open']);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('cancels a pending retry when closed', () => {
    const connection = connectStream(() => SESSION, recorder());
    newest().drop();
    connection.close();
    vi.advanceTimersByTime(60_000);

    expect(FakeSocket.instances).toHaveLength(1);
  });
});
