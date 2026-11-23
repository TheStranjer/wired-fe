/**
 * Tests for the streaming client's reconnect over the fake socket: a drop
 * reports failed once, retries with a doubling delay capped at 60 s on an
 * injectable timer, re-joins what is wanted and reports open again; a refused
 * token (close code 1008 or 401) and closing end all of it. Timers are fake:
 * nothing waits on real time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectStream } from './streamClient';
import { FakeSocket } from '../test/fakeSocket';
import { manualScheduler } from '../test/manualScheduler';
import { SESSION, newest, recorder, sentFrames } from '../test/streamClientHarness';

describe('connectStream reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('caps the retry delay at 60 s', () => {
    connectStream(() => SESSION, recorder());
    for (let attempt = 0; attempt < 8; attempt += 1) {
      newest().drop();
      vi.advanceTimersByTime(60_000);
    }

    expect(FakeSocket.instances).toHaveLength(9);

    newest().drop();
    vi.advanceTimersByTime(59_999);

    expect(FakeSocket.instances).toHaveLength(9);

    vi.advanceTimersByTime(1);

    expect(FakeSocket.instances).toHaveLength(10);
  });

  it('retries on the timer it is given', () => {
    const timer = manualScheduler();
    const connection = connectStream(() => SESSION, recorder(), timer.schedule);
    newest().drop();
    timer.tick();
    newest().drop();
    connection.close();

    expect(timer.intervals).toStrictEqual([1000, 2000]);
    expect(timer.stop).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it.each([1008, 401])('stops for good on close code %i', (code) => {
    const listener = recorder();
    connectStream(() => SESSION, listener);
    newest().open();
    newest().drop(code);
    vi.advanceTimersByTime(120_000);

    expect(listener.statuses).toStrictEqual(['open', 'failed']);
    expect(FakeSocket.instances).toHaveLength(1);
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

    expect(newest().protocols).toStrictEqual(['new']);
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
