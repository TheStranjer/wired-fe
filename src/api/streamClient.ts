/**
 * The streaming client (decision 7): one WebSocket to `/api/v1/streaming` per
 * session. The token is the first `Sec-WebSocket-Protocol` value, never a
 * query parameter (a URL ends up in proxy and access logs). Streams are joined
 * and left with `subscribe` / `unsubscribe` frames, and every frame that
 * arrives is decoded by ./streamFrame and handed to the listener. A connection
 * that drops reports `failed` and is retried with a doubling delay (1 s up to
 * 60 s, on an injectable timer); each time it opens again it re-joins every
 * stream still wanted and reports `open`. A close with code 1008 (policy
 * violation, the instance refusing the token) or 401 is final: `failed` is
 * reported and nothing is retried. The session is read afresh for every
 * attempt, so a refreshed token is picked up by the next reconnect.
 */

import type { ApiSession } from './session';
import { decodeFrame } from './streamFrame';
import type { StreamEvent } from './streaming';
import { type After, timeoutAfter } from './streamTimer';
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
  after?: After,
) => StreamConnection;

/** The path of the streaming endpoint. */
const STREAMING_PATH = '/api/v1/streaming';

/** `WebSocket.OPEN`. */
const OPEN = 1;

/** The first retry's delay, and the longest one. */
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;

/** Close codes that mean the token was refused: retrying would only be refused again. */
const REFUSED_CODES: readonly number[] = [1008, 401];

/** The `ws(s)://` URL of the streaming endpoint at {@link origin}; no token in it. */
function streamUrl(origin: string): string {
  return buildUrl(origin, STREAMING_PATH, {}).replace(/^http/u, 'ws');
}

/** What identifies a subscription: its stream and its tag. */
export function subscriptionKey(subscription: StreamSubscription): string {
  return `${subscription.stream}:${subscription.tag ?? ''}`;
}

/** One connection's socket, retry timer and wanted streams. */
class StreamLink implements StreamConnection {
  private readonly wanted = new Map<string, StreamSubscription>();
  private socket: WebSocket | null = null;
  private cancelRetry: (() => void) | null = null;
  private attempt = 0;
  private readonly session: () => ApiSession;
  private readonly listener: StreamListener;
  private readonly after: After;

  constructor(session: () => ApiSession, listener: StreamListener, after: After) {
    this.session = session;
    this.listener = listener;
    this.after = after;
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
    this.cancelRetry?.();
    this.cancelRetry = null;
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
    const { origin, token } = this.session();
    let socket: WebSocket;
    try {
      socket = new WebSocket(streamUrl(origin), token === null ? [] : [token]);
    } catch {
      // A token that is no valid subprotocol can never connect: final.
      this.listener.onStatus('failed');
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.opened();
    });
    socket.addEventListener('message', (message: MessageEvent) => {
      const data: unknown = message.data;
      this.received(data);
    });
    // The browser always follows an `error` with a `close`, which carries the code.
    socket.addEventListener('close', (event: CloseEvent) => {
      if (this.socket === socket) {
        this.lost(event.code);
      }
    });
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

  /** The socket went down: say so, and try again after the next delay unless the token was refused. */
  private lost(code: number): void {
    this.socket = null;
    this.listener.onStatus('failed');
    if (REFUSED_CODES.includes(code)) {
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS);
    this.attempt += 1;
    this.cancelRetry = this.after(() => {
      this.cancelRetry = null;
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
  after: After = timeoutAfter,
): StreamConnection {
  return new StreamLink(session, listener, after);
}
