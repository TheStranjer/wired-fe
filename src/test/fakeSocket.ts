/**
 * A stand-in for the browser's WebSocket (AGENTS.md "Testing": no real
 * network). The Vitest setup installs it as the global for every test, so a
 * mounted app that opens its streams reaches nothing; a test that cares drives
 * the sockets it finds in {@link FakeSocket.instances}: open one, deliver a
 * frame, drop it, and read what was sent.
 */

/** One listener, as `addEventListener` takes it. */
type Listener = (event: unknown) => void;

/** A WebSocket that never touches the network and does only what a test tells it to. */
export class FakeSocket {
  /** Every socket opened since the last {@link FakeSocket.reset}, oldest first. */
  static instances: FakeSocket[] = [];

  readonly url: string;
  /** The text frames the client sent. */
  readonly sent: string[] = [];
  /** 0 connecting, 1 open, 3 closed, as in the browser. */
  readyState = 0;
  /** Whether the client closed this socket. */
  closed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  /** Forgets every socket opened so far. */
  static reset(): void {
    FakeSocket.instances = [];
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  /** The handshake finished. */
  open(): void {
    this.readyState = 1;
    this.emit('open', {});
  }

  /** A frame arrived. */
  message(data: unknown): void {
    this.emit('message', { data });
  }

  /** The connection dropped, as the browser reports it: an error, then a close. */
  drop(): void {
    this.readyState = 3;
    this.emit('error', {});
    this.emit('close', {});
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
