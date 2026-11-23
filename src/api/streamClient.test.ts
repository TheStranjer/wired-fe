/**
 * Tests for the streaming client over the fake socket: the URL and its token
 * (a subprotocol, never a query parameter), subscribe and unsubscribe frames
 * (before and after the socket opens), and decoded events. The reconnect is in
 * ./streamClient.reconnect.test.ts. Timers are fake: nothing waits on real time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectStream } from './streamClient';
import { FakeSocket } from '../test/fakeSocket';
import { status } from '../test/fixtures';
import { SESSION, newest, recorder, sentFrames } from '../test/streamClientHarness';

/** A WebSocket constructor that refuses its protocols, as the browser does for an invalid token. */
function rejectingSocket(): never {
  throw new SyntaxError('invalid subprotocol');
}

describe(connectStream, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens wss with the token as the subprotocol, not in the URL', () => {
    connectStream(() => SESSION, recorder());

    expect(newest().url).toBe('wss://wired.example/api/v1/streaming');
    expect(newest().url).not.toContain('access_token');
    expect(newest().protocols).toStrictEqual(['tok-en']);
  });

  it('opens ws without a token or protocols for an http origin', () => {
    connectStream(() => ({ origin: 'http://localhost:4000', token: null }), recorder());

    expect(newest().url).toBe('ws://localhost:4000/api/v1/streaming');
    expect(newest().protocols).toStrictEqual([]);
  });

  it('reports failed and never retries when the socket cannot be built', () => {
    vi.stubGlobal('WebSocket', rejectingSocket);
    const listener = recorder();
    connectStream(() => ({ origin: SESSION.origin, token: 'bad token' }), listener);
    vi.advanceTimersByTime(120_000);

    expect(listener.statuses).toStrictEqual(['failed']);
  });

  it('sends a hashtag subscribe frame on the open socket without reconnecting', () => {
    const connection = connectStream(() => SESSION, recorder());
    newest().open();
    connection.subscribe({ stream: 'hashtag', tag: 'rust' });
    connection.unsubscribe({ stream: 'hashtag', tag: 'rust' });

    expect(FakeSocket.instances).toHaveLength(1);
    expect(newest().sent).toStrictEqual([
      '{"type":"subscribe","stream":"hashtag","tag":"rust"}',
      '{"type":"unsubscribe","stream":"hashtag","tag":"rust"}',
    ]);
  });

  it('parses a stringified status payload into a status', () => {
    const listener = recorder();
    const post = status('1');
    connectStream(() => SESSION, listener);
    newest().open();
    newest().message(
      JSON.stringify({ stream: ['user'], event: 'update', payload: JSON.stringify(post) }),
    );

    expect(listener.events).toStrictEqual([{ kind: 'update', stream: ['user'], status: post }]);
  });

  it('drops a malformed payload and keeps an unmodelled event as other', () => {
    const listener = recorder();
    connectStream(() => SESSION, listener);
    newest().open();
    newest().message(JSON.stringify({ stream: ['user'], event: 'update', payload: '{nope' }));
    newest().message(JSON.stringify({ stream: ['user'], event: 'filters_changed' }));

    expect(listener.events).toStrictEqual([{ kind: 'other', event: 'filters_changed' }]);
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
});
