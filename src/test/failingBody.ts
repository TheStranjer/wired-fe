/**
 * A 200 response whose body rejects when it is read, as a connection that
 * drops mid-body or a signal that aborts after the headers arrived does.
 */

/** A response whose body stream errors with {@link reason} on the first read. */
export function failingBody(reason: unknown): Response {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(reason);
    },
  });
  return new Response(body, { status: 200 });
}

/** The error a body read rejects with when the request's signal aborts. */
export function abortReason(): DOMException {
  return new DOMException('signal is aborted without reason', 'AbortError');
}
