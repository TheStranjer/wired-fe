/**
 * The streaming client (decision 7): one WebSocket to `/api/v1/streaming` per
 * session. The token rides the `access_token` query parameter, streams are
 * joined and left with `subscribe` / `unsubscribe` frames, and every frame
 * that arrives is decoded by ./streamFrame and handed to the listener. A
 * connection that drops reports `failed` and is retried with a doubling,
 * capped delay; each time it opens again it re-joins every stream still
 * wanted and reports `open`. The session is read afresh for every attempt, so
 * a refreshed token is picked up by the next reconnect.
 */

import type { ApiSession } from './session';
import { decodeFrame } from './streamFrame';
import type { StreamEvent } from './streaming';
import { buildUrl } from './url';

/** One stream to join: its name, and the tag when the stream is `hashtag`. */
export type StreamSubscription = {
  readonly stream: string;
  readonly tag?: string;
};

/** Whether the connection is up (`open`) or down and being retried (`failed`). */
export type StreamStatus = 'open' | 'failed';

/** What the client reports: every decoded event, and every change of status. */
export type StreamListener = {
  readonly onEvent: (event: StreamEvent) => void;
  readonly onStatus: (status: StreamStatus) => void;
};

/** The handle on one connection. */
export type StreamConnection = {
  readonly subscribe: (subscription: StreamSubscription) => void;
  readonly unsubscribe: (subscription: StreamSubscription) => void;
  /** Closes the socket and cancels any retry; nothing is reported afterwards. */
  readonly close: () => void;
};

/** Opens a connection that reads its session from {@link session} on every attempt. */
export type ConnectStream = (
  session: () => ApiSession,
  listener: StreamListener,
) => StreamConnection;

/** The path of the streaming endpoint. */
const STREAMING_PATH = '/api/v1/streaming';

/** `WebSocket.OPEN`. */
const OPEN = 1;

/** The first retry's delay, and the longest one. */
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** The `ws(s)://` URL of the session's streaming endpoint, with its token. */
function streamUrl(session: ApiSession): string {
  const query = session.token === null ? {} : { access_token: session.token };
  return buildUrl(session.origin, STREAMING_PATH, query).replace(/^http/u, 'ws');
}

/** What identifies a subscription: its stream and its tag. */
export function subscriptionKey(subscription: StreamSubscription): string {
  return `${subscription.stream}:${subscription.tag ?? ''}`;
}

/** One connection's socket, retry timer and wanted streams. */
class StreamLink implements StreamConnection {
  private readonly wanted = new Map<string, StreamSubscription>();
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private readonly session: () => ApiSession;
  private readonly listener: StreamListener;

  constructor(session: () => ApiSession, listener: StreamListener) {
    this.session = session;
    this.listener = listener;
    this.open();
  }

  subscribe = (sub: StreamSubscription): void => {
    this.wanted.set(subscriptionKey(sub), sub);
    this.send('subscribe', sub);
  };

  unsubscribe = (sub: StreamSubscription): void => {
    this.wanted.delete(subscriptionKey(sub));
    this.send('unsubscribe', sub);
  };

  /** Ends the connection for good: no retry, no report. */
  close = (): void => {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const { socket } = this;
    this.socket = null;
    socket?.close();
  };

  /** Sends one `subscribe` or `unsubscribe` frame, when the socket is open. */
  private send(type: 'subscribe' | 'unsubscribe', sub: StreamSubscription): void {
    if (this.socket?.readyState !== OPEN) {
      return;
    }
    const tag = sub.tag === undefined ? {} : { tag: sub.tag };
    this.socket.send(JSON.stringify({ type, stream: sub.stream, ...tag }));
  }

  /** Opens the socket and wires its events to this link. */
  private open(): void {
    const socket = new WebSocket(streamUrl(this.session()));
    this.socket = socket;
    const down = (): void => {
      if (this.socket === socket) {
        this.lost();
      }
    };
    socket.addEventListener('open', () => {
      this.opened();
    });
    socket.addEventListener('message', (message: MessageEvent) => {
      const data: unknown = message.data;
      this.received(data);
    });
    socket.addEventListener('close', down);
    socket.addEventListener('error', down);
  }

  /** The socket came up: join everything wanted and say so. */
  private opened(): void {
    this.attempt = 0;
    for (const sub of this.wanted.values()) {
      this.send('subscribe', sub);
    }
    this.listener.onStatus('open');
  }

  /** One frame arrived: its event, when it is one. */
  private received(data: unknown): void {
    const event = typeof data === 'string' ? decodeFrame(data) : null;
    if (event !== null) {
      this.listener.onEvent(event);
    }
  }

  /** The socket went down: say so, and try again after the next delay. */
  private lost(): void {
    this.socket = null;
    this.listener.onStatus('failed');
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS);
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }
}

/**
 * Connects to the session's instance and keeps the connection up until
 * {@link StreamConnection.close}; streams subscribed before the socket opens
 * are joined as it does.
 */
export function connectStream(
  session: () => ApiSession,
  listener: StreamListener,
): StreamConnection {
  return new StreamLink(session, listener);
}
