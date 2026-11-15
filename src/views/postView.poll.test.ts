/**
 * Tests for the poll half of postView: api's Poll mapped onto the row's own
 * names with the tallies the backend hid kept hidden, a deadline that is read
 * as a Date or stayed null, and the poll read from the displayed status, never
 * from the boost around it.
 */

import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import type { Viewer } from './postView';
import { status } from '../test/fixtures';

const SIGNED_OUT: Viewer = { origin: 'https://wired.example', accountId: null };

/** The wire shape of a poll: Tabs uncounted, Spaces at 17, the viewer on Tabs. */
const WIRE_POLL = {
  id: 'p1',
  expires_at: '2026-11-13T12:00:00.000Z',
  expired: false,
  multiple: true,
  votes_count: 42,
  voters_count: 40,
  options: [{ title: 'Tabs' }, { title: 'Spaces', votes_count: 17 }],
  voted: true,
  own_votes: [0],
};

/** The smallest poll the schema accepts: expired, empty, no deadline named. */
const BARE_POLL = {
  id: 'p2',
  expired: true,
  multiple: false,
  votes_count: 0,
  options: [],
};

describe('postView poll', () => {
  it('maps a poll onto the row names, hiding nothing it was not hidden', () => {
    const post = status('a', { poll: WIRE_POLL });

    expect(postView(post, SIGNED_OUT).poll).toStrictEqual({
      options: [
        { title: 'Tabs', votes: null },
        { title: 'Spaces', votes: 17 },
      ],
      totalVotes: 42,
      expiresAt: new Date('2026-11-13T12:00:00.000Z'),
      expired: false,
      multiple: true,
      ownVotes: [0],
      voted: true,
    });
  });

  it('keeps a deadlineless poll deadlineless', () => {
    const post = status('a', { poll: BARE_POLL });

    expect(postView(post, SIGNED_OUT).poll).toStrictEqual({
      options: [],
      totalVotes: 0,
      expiresAt: null,
      expired: true,
      multiple: false,
      ownVotes: [],
      voted: false,
    });
  });

  it('shows the poll of the original, not the boost', () => {
    const boost = status('boost', {
      poll: WIRE_POLL,
      reblog: status('orig', { poll: { ...WIRE_POLL, votes_count: 7 } }),
    });

    expect(postView(boost, SIGNED_OUT).poll?.totalVotes).toBe(7);
  });

  it('gives a status without a poll no poll line', () => {
    expect(postView(status('a'), SIGNED_OUT).poll).toBeNull();
  });
});
