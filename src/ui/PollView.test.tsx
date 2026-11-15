/**
 * Tests for the poll lines: the option rows with their bars, padded titles and
 * percentages, the mark on the options this account voted for, and every
 * footer the ticket names — open, closed, voted, multiple, zero votes, hidden
 * tallies and the singular vote.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PollView } from './PollView';
import type { PollViewData } from './PollView';

/** A moment whose clock reads the same in every timezone: local 23:59. */
const CLOSES = new Date(2026, 0, 2, 23, 59);

/** Open, single choice, unvoted: 10 votes, 3 on `yes`, 7 on `no`. */
function poll(overrides: Partial<PollViewData> = {}): PollViewData {
  return {
    options: [
      { title: 'yes', votes: 3 },
      { title: 'no', votes: 7 },
    ],
    totalVotes: 10,
    expiresAt: CLOSES,
    expired: false,
    multiple: false,
    ownVotes: [],
    voted: false,
    ...overrides,
  };
}

/** The whole component as one text run, over {@link data} and row label a3. */
function pollText(data: PollViewData, label = 'a3'): string {
  const { container } = render(<PollView clockFormat="24h" label={label} poll={data} />);
  return container.textContent;
}

describe(PollView, () => {
  it('draws one bar line per option and the footer under them', () => {
    expect(pollText(poll())).toBe(
      [
        '[1] yes  ██████░░░░░░░░░░░░░░  30%',
        '[2] no   ██████████████░░░░░░  70%',
        '10 votes · closes 23:59 · /vote a3 1',
      ].join(''),
    );
  });

  it('names the row the hint votes on by its label', () => {
    expect(pollText(poll(), 'b7')).toContain('/vote b7 1');
  });

  it('marks the options this account voted for, and drops the hint once voted', () => {
    expect(pollText(poll({ ownVotes: [1], voted: true }))).toBe(
      [
        '[1] yes  ██████░░░░░░░░░░░░░░  30%',
        '[2] no   ██████████████░░░░░░  70%  ✓',
        '10 votes · closes 23:59',
      ].join(''),
    );
  });

  it('marks both options of a voted multiple choice poll', () => {
    const text = pollText(poll({ ownVotes: [0, 1], voted: true, multiple: true }));

    expect(text.match(/✓/gu)?.length).toBe(2);
    expect(text).toContain('(multiple choice)');
  });

  it('says closed and hints nothing once the poll has expired', () => {
    expect(pollText(poll({ expired: true }))).toBe(
      [
        '[1] yes  ██████░░░░░░░░░░░░░░  30%',
        '[2] no   ██████████████░░░░░░  70%',
        '10 votes · closed',
      ].join(''),
    );
  });

  it('appends the multiple choice word to the footer', () => {
    expect(pollText(poll({ multiple: true }))).toContain(' · /vote a3 1 · (multiple choice)');
  });

  it('says nothing about a deadline the backend never named', () => {
    expect(pollText(poll({ expiresAt: null }))).toContain('10 votes · /vote a3 1');
  });

  it('counts a single vote in the singular', () => {
    const single = poll({
      options: [
        { title: 'yes', votes: 1 },
        { title: 'no', votes: 0 },
      ],
      totalVotes: 1,
    });

    expect(pollText(single)).toContain('1 vote · closes 23:59');
  });

  it('shows empty bars and zero per cent while nobody has voted', () => {
    const fresh = poll({
      options: [
        { title: 'yes', votes: 0 },
        { title: 'no', votes: 0 },
      ],
      totalVotes: 0,
    });

    expect(pollText(fresh)).toBe(
      [
        '[1] yes  ░░░░░░░░░░░░░░░░░░░░   0%',
        '[2] no   ░░░░░░░░░░░░░░░░░░░░   0%',
        '0 votes · closes 23:59 · /vote a3 1',
      ].join(''),
    );
  });

  it('asks ? where the backend hides an option tally', () => {
    const hidden = poll({
      options: [
        { title: 'yes', votes: null },
        { title: 'no', votes: null },
      ],
      totalVotes: 0,
      voted: true,
    });

    expect(pollText(hidden)).toBe(
      [
        '[1] yes  ░░░░░░░░░░░░░░░░░░░░    ?',
        '[2] no   ░░░░░░░░░░░░░░░░░░░░    ?',
        '0 votes · closes 23:59',
      ].join(''),
    );
  });

  it('rounds shares to whole per cent and to the nearest cell', () => {
    const third = poll({
      options: [
        { title: 'a', votes: 1 },
        { title: 'b', votes: 2 },
      ],
      totalVotes: 3,
    });

    expect(pollText(third)).toContain('[1] a  ███████░░░░░░░░░░░░░  33%');
    expect(pollText(third)).toContain('[2] b  █████████████░░░░░░░  67%');
  });

  it('pads every title to the longest one', () => {
    const uneven = poll({
      options: [
        { title: 'a', votes: 0 },
        { title: 'bcd', votes: 0 },
      ],
    });
    const lines = pollText(uneven);

    expect(lines).toContain('[1] a    ░');
    expect(lines).toContain('[2] bcd  ░');
  });

  it('closes by the clock the reader chose', () => {
    const text = render(<PollView clockFormat="12h" label="a3" poll={poll()} />).container
      .textContent;

    expect(text).toContain('closes 11:59pm');
  });

  it('draws nothing for a poll without options', () => {
    expect(pollText(poll({ options: [] }))).toBe('10 votes · closes 23:59 · /vote a3 1');
  });
});
