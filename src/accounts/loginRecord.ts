/**
 * The record a finished login stores (decision 8): the verified account and
 * the token answer that proved it become the fields of one stored account,
 * with the access token's expiry worked out from the caller's clock. Pure.
 */

import type { StoredAccount } from './accountStore';
import { fullHandle } from './handle';
import type { PendingLogin } from './pendingLogin';
import type { Token } from '../api/oauth';
import type { Account } from '../api/schemas/account';

/** A finished exchange: the token answer and the account it proves. */
export type Verification = { readonly account: Account; readonly token: Token };

/**
 * The stored record for a verified account: where, who, its tokens and the
 * expiry (ms epoch) that {@link now} plus the token's lifetime gives, or null
 * when the instance names no lifetime.
 */
export function toAdd(
  pending: PendingLogin,
  verified: Verification,
  now: number,
): Omit<StoredAccount, 'key'> {
  const { account, token } = verified;
  return {
    origin: pending.origin,
    accountId: account.id,
    handle: fullHandle(account, pending.origin),
    token: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in === null ? null : now + token.expires_in * 1000,
  };
}
