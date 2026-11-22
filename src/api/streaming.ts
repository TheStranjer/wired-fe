/**
 * The streaming protocol's decoded frame (decision 7). One WebSocket message off
 * `/api/v1/streaming` is a `{ event, stream, payload }` object; the client that
 * reads the socket hands what it recognized to its callers as one of these, with
 * the payload already parsed by the same schemas the REST endpoints use, so a
 * frame and a paged answer agree on one model (WiredFE's own, decision 7).
 * `stream` is the list of stream names the instance sent the frame on —
 * `['user']`, `['public:local']`, `['public']`, `['hashtag', '<tag>']` — which
 * is what src/state/streamActions.ts routes a frame by; a `delete` carries the
 * deleted status's id, and every event the client does not model keeps only its
 * wire name.
 */

import type { Notification } from './schemas/notification';
import type { Status } from './schemas/status';

/** One event from an account's streaming connection, payload and all. */
export type StreamEvent =
  /** A post nobody has seen yet, on every stream whose timeline it belongs to. */
  | {
      readonly kind: 'update';
      readonly stream: readonly string[];
      readonly status: Status;
    }
  /** An edited post (Wired's and Pleroma's `status.update`), wherever it shows. */
  | {
      readonly kind: 'statusUpdate';
      readonly stream: readonly string[];
      readonly status: Status;
    }
  /** A post that is gone, named by its id; its `stream` is the instance's. */
  | { readonly kind: 'delete'; readonly stream: readonly string[]; readonly id: string }
  /** Anything the account was notified about, on its `user:notification` stream. */
  | {
      readonly kind: 'notification';
      readonly stream: readonly string[];
      readonly notification: Notification;
    }
  /** An event WiredFE does not act on — `filters_changed`, a heartbeat, the rest. */
  | { readonly kind: 'other'; readonly event: string };
