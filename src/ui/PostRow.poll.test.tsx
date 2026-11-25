/**
 * Tests for the poll line of the post row: the option lines and footer the
 * row draws under the body from the poll prop, in the clock format and under
 * the label the row already carries, and the silence when the prop is null.
 * What those lines are made of is ./PollView's own test.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PollViewData } from './PollView';
import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';

const BASE_PROPS: PostRowProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  author: { handle: 'alice', fullHandle: '@alice@m.example', self: false },
  boostedBy: null,
  via: null,
  replyTo: null,
  quote: null,
  contentHtml: '<p>present day, present time</p>',
  emojis: [],
  spoilerText: '',
  revealed: false,
  poll: null,
  media: [],
  sensitive: false,
  autoExpand: false,
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
  selected: false,
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
  onPop: vi.fn<() => void>(),
  onContentLink: () => false,
};

/** Voted, single choice: 10 votes, 3 on `yes` — the viewer's — and 7 on `no`. */
const POLL: PollViewData = {
  options: [
    { title: 'yes', votes: 3 },
    { title: 'no', votes: 7 },
  ],
  totalVotes: 10,
  expiresAt: new Date(2026, 0, 2, 23, 59),
  expired: false,
  multiple: false,
  ownVotes: [0],
  voted: true,
};

describe('PostRow poll lines', () => {
  it('draws the poll under the body, as one line per option plus a footer', () => {
    const { container } = render(<PostRow {...BASE_PROPS} poll={POLL} />);

    expect(container.textContent).toBe(
      [
        '[a3] 23:04 <alice> present day, present time',
        '[1] yes  ██████░░░░░░░░░░░░░░  30%  ✓',
        '[2] no   ██████████████░░░░░░  70%',
        '10 votes · closes 23:59',
      ].join(''),
    );
  });

  it('shows no poll line for a post without a poll', () => {
    const { container } = render(<PostRow {...BASE_PROPS} />);

    expect(container.textContent).toBe('[a3] 23:04 <alice> present day, present time');
  });

  it('hands the poll the label its /vote hint names', () => {
    const { container } = render(
      <PostRow {...BASE_PROPS} poll={{ ...POLL, ownVotes: [], voted: false }} />,
    );

    expect(container.textContent).toContain('/vote a3 1');
  });
});
