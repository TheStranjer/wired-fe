/**
 * JSON text that does not depend on the order keys were added in: every object
 * is written with its keys sorted, so two values that hold the same things
 * give the same text. The desk sync (decision 17) compares the desk before
 * and after a change this way.
 */

/** Whether {@link value} is an object with keys, rather than an array or a scalar. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Orders two `[key, value]` entries by key. Keys of one object never repeat. */
function byKey(a: readonly [string, unknown], b: readonly [string, unknown]): number {
  return a[0] < b[0] ? -1 : 1;
}

/** {@link value} as JSON with the keys of every object sorted. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key: string, inner: unknown) =>
    isRecord(inner) ? Object.fromEntries(Object.entries(inner).sort(byKey)) : inner,
  );
}
