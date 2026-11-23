/**
 * A gate for concurrency tests: callers wait inside {@link arrivalGate}'s
 * `arrive` until the expected number of them have arrived, which proves the
 * calls were in flight at the same time.
 */

/** The gate of a concurrency test: it opens only when {@link expected} arrive. */
export function arrivalGate(expected: number): {
  readonly arrive: () => Promise<void>;
  readonly arrived: () => number;
} {
  const allArrived = Promise.withResolvers<undefined>();
  let count = 0;
  return {
    arrive: async () => {
      count += 1;
      if (count === expected) {
        allArrived.resolve(undefined);
      }
      await allArrived.promise;
    },
    arrived: () => count,
  };
}
