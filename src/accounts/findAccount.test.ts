/**
 * Tests for the account query resolver: the 1-based index (in range, out of
 * range, ahead of a username that starts with the same digits), the full
 * handle with and without its leading `@` and in any case, the unique
 * username prefix, and the answers of `null`: empty query, no match, out of
 * range number and an ambiguous prefix.
 */
import { describe, expect, it } from 'vitest';

import type { StoredAccount } from './accountStore';
import { findAccount } from './findAccount';

/** One stored account, distinguished by nothing but its handle. */
function account(handle: string): StoredAccount {
  const [username = handle] = handle.split('@');
  return {
    key: `https://wired.example#${username}`,
    origin: 'https://wired.example',
    accountId: username,
    handle,
    token: `token-${username}`,
  };
}

const LAIN = account('lain@wired.example');
const BOB = account('bob@wired.example');
const ALICE = account('alice@other.example');
const ALEX = account('alex@other.example');

/** The list every test resolves against, unless it names its own. */
const ACCOUNTS: readonly StoredAccount[] = [LAIN, BOB, ALICE, ALEX];

describe(findAccount, () => {
  it('finds the account a 1-based index names', () => {
    expect(findAccount(ACCOUNTS, '1')).toStrictEqual(LAIN);
    expect(findAccount(ACCOUNTS, '3')).toStrictEqual(ALICE);
  });

  it('prefers the index over a username that starts with the same digit', () => {
    const two = account('2bob@wired.example');

    expect(findAccount([LAIN, two], '2')).toStrictEqual(two);
  });

  it('answers null for an index outside the list', () => {
    expect(findAccount(ACCOUNTS, '0')).toBeNull();
    expect(findAccount(ACCOUNTS, '5')).toBeNull();
  });

  it('finds the account whose full handle the query is', () => {
    expect(findAccount(ACCOUNTS, 'lain@wired.example')).toStrictEqual(LAIN);
  });

  it('accepts the leading @ and any case in a full handle', () => {
    expect(findAccount(ACCOUNTS, '@Alice@Other.Example')).toStrictEqual(ALICE);
  });

  it('finds the account a unique username prefix names', () => {
    expect(findAccount(ACCOUNTS, 'lai')).toStrictEqual(LAIN);
    expect(findAccount(ACCOUNTS, '@bo')).toStrictEqual(BOB);
  });

  it('answers null when several usernames start with the prefix', () => {
    expect(findAccount(ACCOUNTS, 'al')).toBeNull();
  });

  it('answers null for a prefix no username starts with', () => {
    expect(findAccount(ACCOUNTS, 'zzz')).toBeNull();
  });

  it('does not match a domain fragment alone', () => {
    expect(findAccount(ACCOUNTS, 'wired.example')).toBeNull();
  });

  it('answers null for an empty or blank query', () => {
    expect(findAccount(ACCOUNTS, '')).toBeNull();
    expect(findAccount(ACCOUNTS, '   ')).toBeNull();
    expect(findAccount(ACCOUNTS, '@')).toBeNull();
  });

  it('answers null from an empty list', () => {
    expect(findAccount([], 'lain@wired.example')).toBeNull();
  });
});
