/**
 * Shared helpers for the streaming client's tests: a session, a listener that
 * records what it is told, and readers for the newest fake socket.
 */
import { FakeSocket } from './fakeSocket';
import type { StreamListener, StreamStatus } from '../api/streamClient';
import type { StreamEvent } from '../api/streaming';

/** A session on a secure origin with a plain token. */
export const SESSION = { origin: 'https://wired.example', token: 'tok-en' };

/** A listener that records every event and status it is told. */
export type Recorder = StreamListener & {
  readonly events: StreamEvent[];
  readonly statuses: StreamStatus[];
};

/** A fresh {@link Recorder}. */
export function recorder(): Recorder {
  const events: StreamEvent[] = [];
  const statuses: StreamStatus[] = [];

  return {
    events,
    statuses,
    onEvent: (event) => events.push(event),
    onStatus: (state) => statuses.push(state),
  };
}

/** The newest socket the client opened. */
export function newest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (socket === undefined) {
    throw new Error('no socket was opened');
  }

  return socket;
}

/** The frames the newest socket was sent, parsed. */
export function sentFrames(): readonly unknown[] {
  return newest().sent.map((text) => JSON.parse(text) as unknown);
}
