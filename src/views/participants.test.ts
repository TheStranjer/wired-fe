/**
 * Tests for the side pane's participants (WFE-133): the distinct authors of a
 * buffer's post and notification lines, most recent first — a boost naming
 * the author of its original, a notification naming its actor, client messages
 * naming nobody — folded by account id and capped at the limit.
 */
import { describe, expect, it } from 'vitest';

import { participants } from './participants';
import type { Account } from '../api/schemas/account';
import { type Buffer, EMPTY_BUFFER, type LineData } from '../state/buffer';
import { postKey } from '../state/bufferPosts';
import { status, TEST_DATE } from '../test/fixtures';

/** An author in the shape the Status schema reads. */
function author(acct: string, id = acct): Account {
  return {
    id,
    username: acct.split('@')[0] ?? acct,
    acct,
    fqn: null,
    display_name: '',
    locked: false,
    bot: false,
    group: false,
    discoverable: null,
    created_at: TEST_DATE,
    note: '',
    url: `https://example/${acct}`,
    uri: null,
    avatar: '',
    avatar_static: '',
    header: '',
    header_static: '',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
    last_status_at: null,
    emojis: [],
    fields: [],
    moved: null,
    pleroma: null,
  };
}

const ALICE = author('alice@m.example');
const BOB = author('bob@m.example');
const NINE = author('nine@pleroma.example');

/** A post line by {@link who}, keyed by its status id. */
function post(id: string, who: Account): LineData {
  return { kind: 'post', key: postKey(id), status: status(id, { account: who }) };
}

/** A boost of status `2` by {@link who}: the line's own account boosts. */
function boost(id: string, who: Account): LineData {
  return {
    kind: 'post',
    key: postKey(id),
    status: status(id, { account: who, reblog: status(`${id}-orig`, { account: ALICE }) }),
  };
}

/** A scrollback holding {@link lines}, oldest first as the buffer keeps them. */
function bufferWith(lines: readonly LineData[]): Buffer {
  return { ...EMPTY_BUFFER, lines };
}

describe(participants, () => {
  it('lists nothing for an empty buffer', () => {
    expect(participants(bufferWith([]), 50)).toStrictEqual([]);
  });

  it('lists the distinct authors most recent first', () => {
    const buffer = bufferWith([post('1', ALICE), post('2', BOB)]);

    expect(participants(buffer, 50).map((account) => account.acct)).toStrictEqual([
      'bob@m.example',
      'alice@m.example',
    ]);
  });

  it('folds an author with several lines into one entry', () => {
    const buffer = bufferWith([post('1', ALICE), post('2', BOB), post('3', ALICE)]);

    expect(participants(buffer, 50).map((account) => account.id)).toStrictEqual([
      'alice@m.example',
      'bob@m.example',
    ]);
  });

  it('names the boosted original author, not the booster', () => {
    const buffer = bufferWith([post('1', BOB), boost('2', NINE)]);

    expect(participants(buffer, 50).map((account) => account.acct)).toStrictEqual([
      'alice@m.example',
      'bob@m.example',
    ]);
  });

  it('names a notification by its actor', () => {
    const line: LineData = {
      kind: 'notification',
      key: 'note:1',
      notification: {
        id: '1',
        type: 'follow',
        kind: 'follow',
        created_at: TEST_DATE,
        account: BOB,
        status: null,
        emoji: null,
      },
    };

    expect(participants(bufferWith([post('1', ALICE), line]), 50).map((a) => a.acct)).toStrictEqual(
      ['bob@m.example', 'alice@m.example'],
    );
  });

  it('skips client messages', () => {
    const line: LineData = {
      kind: 'system',
      key: 'sys:0',
      date: new Date(TEST_DATE),
      level: 'info',
      text: 'hello',
    };

    expect(participants(bufferWith([line]), 50)).toStrictEqual([]);
  });

  it('caps the list at the limit, keeping the most recent', () => {
    const buffer = bufferWith([post('1', ALICE), post('2', BOB), post('3', NINE)]);

    expect(participants(buffer, 2).map((account) => account.acct)).toStrictEqual([
      'nine@pleroma.example',
      'bob@m.example',
    ]);
  });

  it('lists nobody for a limit of zero', () => {
    expect(participants(bufferWith([post('1', ALICE)]), 0)).toStrictEqual([]);
  });
});
