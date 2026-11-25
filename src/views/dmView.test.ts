/**
 * Tests for the direct-message view helpers (WFE-234): the recipients a post
 * names besides its author, and the grouping of a conversation into runs, where
 * a message by the same author within five minutes of the one above it drops
 * its header.
 */
import { describe, expect, it } from 'vitest';

import { collapsesHeader, recipientsOf } from './dmView';
import type { PostLineData, LineData } from '../state/buffer';
import { status } from '../test/fixtures';

const ALICE = { ...status('x').account, id: '9', acct: 'alice@other.example' };
const MENTIONS = [
  { id: '1', username: 'lain', acct: 'lain', url: 'https://wired.example/@lain' },
  { id: '9', username: 'alice', acct: 'alice@other.example', url: 'https://other.example/@alice' },
  { id: '10', username: 'bob', acct: 'bob@other.example', url: 'https://other.example/@bob' },
];

/** A post line `key`, written by `account` at `createdAt`. */
function post(key: string, account: typeof ALICE, createdAt: string): PostLineData {
  return {
    kind: 'post',
    key,
    accountKey: null,
    status: status(key, { account, created_at: createdAt, visibility: 'direct' }),
  };
}

const LAIN = status('x').account;
const AT = (minutes: number): string => new Date(Date.UTC(2026, 0, 2, 12, minutes)).toISOString();

describe(recipientsOf, () => {
  it('lists the mentioned accounts but the author, marking the viewer', () => {
    const direct = status('d', { account: ALICE, mentions: MENTIONS, visibility: 'direct' });

    expect(recipientsOf(direct, { origin: 'https://wired.example', accountId: '1' })).toStrictEqual(
      [
        { handle: 'lain', self: true },
        { handle: 'bob@other.example', self: false },
      ],
    );
  });

  it('marks nobody when nobody is signed in', () => {
    const direct = status('d', { account: ALICE, mentions: MENTIONS });

    expect(
      recipientsOf(direct, { origin: '', accountId: null }).some((recipient) => recipient.self),
    ).toBe(false);
  });

  it('reads the original of a boost', () => {
    const boost = status('b', { reblog: status('d', { account: ALICE, mentions: MENTIONS }) });

    expect(recipientsOf(boost, { origin: '', accountId: null })).toHaveLength(2);
  });
});

describe(collapsesHeader, () => {
  it('collapses a message by the same author within five minutes of the one above', () => {
    const lines: LineData[] = [post('a', ALICE, AT(0)), post('b', ALICE, AT(5))];

    expect(collapsesHeader(lines, 'b')).toBe(true);
  });

  it('keeps the header on the first message', () => {
    expect(collapsesHeader([post('a', ALICE, AT(0))], 'a')).toBe(false);
  });

  it('keeps the header when the gap is over five minutes', () => {
    const lines: LineData[] = [post('a', ALICE, AT(0)), post('b', ALICE, AT(6))];

    expect(collapsesHeader(lines, 'b')).toBe(false);
  });

  it('keeps the header when the author changes', () => {
    const lines: LineData[] = [post('a', ALICE, AT(0)), post('b', LAIN, AT(1))];

    expect(collapsesHeader(lines, 'b')).toBe(false);
  });

  it('keeps the header under a line that is not a post', () => {
    const notice: LineData = {
      kind: 'system',
      key: 's',
      date: new Date(0),
      level: 'info',
      text: '',
    };

    expect(collapsesHeader([notice, post('b', ALICE, AT(0))], 'b')).toBe(false);
  });

  it('collapses nothing for a line that is not a post or not there', () => {
    const notice: LineData = {
      kind: 'system',
      key: 's',
      date: new Date(0),
      level: 'info',
      text: '',
    };

    expect(collapsesHeader([post('a', ALICE, AT(0)), notice], 's')).toBe(false);
    expect(collapsesHeader([post('a', ALICE, AT(0))], 'missing')).toBe(false);
  });

  it('measures the gap whichever message is older', () => {
    const lines: LineData[] = [post('a', ALICE, AT(4)), post('b', ALICE, AT(0))];

    expect(collapsesHeader(lines, 'b')).toBe(true);
  });
});
