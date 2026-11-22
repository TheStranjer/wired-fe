/**
 * Type guards for values of unknown shape.
 */

/** Whether a value is a string-keyed object, e.g. a module namespace. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
