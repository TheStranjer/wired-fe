/**
 * Decoding one text frame off `/api/v1/streaming` into a {@link StreamEvent}
 * (decision 7). A frame is `{ stream, event, payload }` where `payload` is the
 * entity as a JSON *string* — except a `delete`, whose payload is the bare id.
 * Payloads go through the same schemas the REST endpoints use. Anything the
 * client does not model, and any payload that does not parse, comes back as an
 * `other` event, so one bad frame never stops the connection; text that is no
 * frame at all comes back as null.
 */

import * as v from 'valibot';

import { NotificationSchema } from './schemas/notification';
import { StatusSchema } from './schemas/status';
import type { StreamEvent } from './streaming';

/** The envelope every frame shares. */
const FrameSchema = v.object({
  stream: v.optional(v.array(v.string()), []),
  event: v.string(),
  payload: v.optional(v.string()),
});

/** The envelope's fields once parsed. */
type Frame = v.InferOutput<typeof FrameSchema>;

/** The JSON in {@link text}, or null when it is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A post event of {@link kind} from the frame's payload, or null when the payload is no status. */
function statusEvent(frame: Frame, kind: 'update' | 'statusUpdate'): StreamEvent | null {
  const parsed = v.safeParse(StatusSchema, parseJson(frame.payload ?? ''));
  return parsed.success ? { kind, stream: frame.stream, status: parsed.output } : null;
}

/** A notification event from the frame's payload, or null when the payload is none. */
function notificationEvent(frame: Frame): StreamEvent | null {
  const parsed = v.safeParse(NotificationSchema, parseJson(frame.payload ?? ''));
  return parsed.success
    ? { kind: 'notification', stream: frame.stream, notification: parsed.output }
    : null;
}

/** The event a recognized frame carries, or null when it is not one WiredFE models. */
function modelled(frame: Frame): StreamEvent | null {
  switch (frame.event) {
    case 'update':
      return statusEvent(frame, 'update');
    case 'status.update':
      return statusEvent(frame, 'statusUpdate');
    case 'notification':
      return notificationEvent(frame);
    case 'delete':
      return frame.payload === undefined
        ? null
        : { kind: 'delete', stream: frame.stream, id: frame.payload };
    default:
      return null;
  }
}

/**
 * The event one text frame carries; `other` for a frame whose event is not
 * modelled or whose payload does not parse, null for text that is no frame.
 */
export function decodeFrame(text: string): StreamEvent | null {
  const frame = v.safeParse(FrameSchema, parseJson(text));
  if (!frame.success) {
    return null;
  }
  return modelled(frame.output) ?? { kind: 'other', event: frame.output.event };
}
