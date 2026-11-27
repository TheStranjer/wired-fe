/**
 * Tests for which account opens a route (decision 4): the active account for
 * an unqualified route, and for a qualified one the active account on that
 * origin, else the first account on it, else nobody.
 */
import { describe, expect, it } from 'vitest';

import { routeAccount } from './routeAccount';
import { type StoredAccount, accountKey } from '../../accounts/accountStore';
import type { Route } from '../../lib/route';

/** An account on {@link origin} with the id {@link id}. */
function account(origin: string, id: string): StoredAccount {
  return {
    key: accountKey(origin, id),
    origin,
    accountId: id,
    handle: `u${id}`,
    token: 'token',
    refreshToken: null,
    expiresAt: null,
  };
}

const A1 = account('https://a.example', '1');
const A2 = account('https://a.example', '2');
const B1 = account('https://b.example', '1');

/** A notice route on the instance {@link origin}. */
function notice(origin: string): Route {
  return { kind: 'notice', value: '7', origin };
}

describe(routeAccount, () => {
  it('is the active account for an unqualified route', () => {
    expect(routeAccount({ kind: 'notice', value: '7' }, B1, [A1, B1])).toBe(B1);
  });

  it('is nobody for an unqualified route with no active account', () => {
    expect(routeAccount({ kind: 'acct', value: 'x' }, null, [])).toBeNull();
  });

  it('is the active account when it is on the route origin', () => {
    expect(routeAccount(notice('https://a.example'), A2, [A1, A2])).toBe(A2);
  });

  it('is the first account on the origin when the active one is elsewhere', () => {
    expect(routeAccount(notice('https://a.example'), B1, [B1, A1, A2])).toBe(A1);
  });

  it('is the first account on the origin when nobody is active', () => {
    expect(routeAccount(notice('https://b.example'), null, [A1, B1])).toBe(B1);
  });

  it('is nobody when no account is on the origin', () => {
    expect(routeAccount(notice('https://c.example'), A1, [A1, B1])).toBeNull();
  });
});
