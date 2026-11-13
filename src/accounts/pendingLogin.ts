/**
 * The pending OAuth login (decision 8): when {@link beginLogin} sends the
 * browser to an instance's authorize page, it stores the `state` it generated
 * together with the origin and redirect URI here, so the callback handler can
 * later check that the `state` coming back is the one this browser sent and
 * belongs to this instance. It lives under the key `pending` of the given
 * {@link Store} and expires after {@link PENDING_LOGIN_TTL_MS}: a login the
 * user never finished must not wait around to be completed by a stranger.
 * Reads are validated, so a corrupt value reads as "no pending login".
 */

import * as v from 'valibot';

import type { Store } from '../storage/store';

/** One login that left the browser for the instance's authorize page. */
export type PendingLogin = {
  /** The instance the browser was sent to, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The random `state` sent with the authorize request (CSRF check). */
  readonly state: string;
  /** The redirect URI the instance will send the browser back to. */
  readonly redirectUri: string;
  /** When the login started, as milliseconds since the epoch. */
  readonly createdAt: number;
};

/** How long a pending login may still be completed: 10 minutes. */
export const PENDING_LOGIN_TTL_MS = 600_000;

/** The single key this module owns inside its {@link Store}. */
const PENDING_KEY = 'pending';

/** A pending login: all four fields, with a finite `createdAt`. */
const PendingLoginSchema: v.GenericSchema<unknown, PendingLogin> = v.object({
  origin: v.string(),
  state: v.string(),
  redirectUri: v.string(),
  createdAt: v.pipe(v.number(), v.finite()),
});

/** Stores the login currently awaiting its callback, replacing any older one. */
export function savePendingLogin(store: Store, pending: PendingLogin): void {
  store.set(PENDING_KEY, pending);
}

/**
 * The login awaiting its callback: the stored one when it is present, valid,
 * and not older than {@link PENDING_LOGIN_TTL_MS} at {@link now} (exactly at
 * the TTL is still valid), else `null`.
 */
export function readPendingLogin(store: Store, now: number): PendingLogin | null {
  const stored = store.get(PENDING_KEY, PendingLoginSchema);
  if (stored === undefined || now > stored.createdAt + PENDING_LOGIN_TTL_MS) {
    return null;
  }
  return stored;
}

/** Forgets the pending login, e.g. once its callback has been checked. */
export function clearPendingLogin(store: Store): void {
  store.remove(PENDING_KEY);
}
