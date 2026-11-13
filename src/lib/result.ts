/**
 * The shared Result type: fallible functions (network calls, parsers,
 * validators) return a `Result` instead of throwing, so failure is part of
 * the signature and callers must handle it. A `Result` is a plain discriminated
 * union; check the `ok` tag to narrow: `if (r.ok)` exposes `r.value`,
 * otherwise `r.error`.
 */

/** The success variant, carrying the produced {@link value}. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** The failure variant, carrying why the operation failed as {@link error}. */
export type Err<E> = { readonly ok: false; readonly error: E };

/** The outcome of a fallible operation: success {@link Ok} or failure {@link Err}. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Wrap a success value as an {@link Ok}. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wrap a failure reason as an {@link Err}. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
