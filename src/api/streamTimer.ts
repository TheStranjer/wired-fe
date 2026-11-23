/**
 * The one-shot timer the streaming client retries on (decision 7). It is a
 * parameter of `connectStream`, so a test hands in its own and never waits on
 * real time.
 */

/** Runs {@link task} once after {@link ms} milliseconds; the returned function cancels it. */
export type After = (task: () => void, ms: number) => () => void;

/** The real timer: `setTimeout`, cleared by the returned function. */
export function timeoutAfter(task: () => void, ms: number): () => void {
  const id = setTimeout(task, ms);
  return () => {
    clearTimeout(id);
  };
}
