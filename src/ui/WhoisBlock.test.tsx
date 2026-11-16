/**
 * Tests for the whois block: one `***` line per piece — the name and
 * parenthesised handle, the sanitized bio, one line per field with its
 * verified mark, the counters and joined day, and the relationship line —
 * the bio and relationship lines left out when there is nothing to say, and
 * hostile markup never surviving into the DOM.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WhoisBlock } from './WhoisBlock';
import type { WhoisBlockProps } from './WhoisBlock';

const NOBODY = { following: false, followedBy: false, blocked: false, muted: false };

const BASE_PROPS: WhoisBlockProps = {
  displayName: 'Lain Iwakura',
  handle: 'lain@wired.example',
  bioHtml: '<p>close the <b>world</b></p><script>evil()</script>',
  fields: [
    { name: 'site', valueHtml: '<a href="https://example.org">example.org</a>', verified: true },
    { name: 'pronouns', valueHtml: 'none', verified: false },
  ],
  counts: { posts: 120, following: 80, followers: 300 },
  joined: '2024-01-02',
  relationships: NOBODY,
};

/** The text of the block's lines, top to bottom. */
function lines(container: HTMLElement): readonly string[] {
  const block = container.querySelector('div');
  if (block === null) {
    throw new Error('the whois block rendered nothing');
  }
  return [...block.children].map((line) => line.textContent);
}

describe(WhoisBlock, () => {
  it('leads with the display name and the parenthesised handle', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(lines(container)[0]).toBe('*** Lain Iwakura (@lain@wired.example)');
  });

  it('indents the bio line and drops the script from it', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(lines(container)[1]).toBe('***   close the world');
    expect(container.querySelector('script')).toBeNull();
  });

  it('omits the bio line when the account has none', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} bioHtml="" />);

    expect(lines(container)[1]).toContain('site:');
  });

  it('prints one indented line per field, in order', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(lines(container)[2]).toContain('***   site: example.org');
    expect(lines(container)[3]).toBe('***   pronouns: none');
    expect(container.querySelector('a')).toHaveAttribute('rel', 'nofollow noopener noreferrer');
  });

  it('marks a verified field with a ✓ and the word, an unverified one with neither', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(lines(container)[3]).not.toContain('✓');
  });

  it('counts posts, following, followers and the joined day on one line', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(lines(container)[4]).toBe(
      '***   posts 120 · following 80 · followers 300 · joined 2024-01-02',
    );
  });

  it('says nothing about relationships when none of them hold', () => {
    const { container } = render(<WhoisBlock {...BASE_PROPS} />);

    expect(lines(container)).toHaveLength(5);
  });

  it('lists only the relationships that hold, in the set order', () => {
    const { container } = render(
      <WhoisBlock {...BASE_PROPS} relationships={{ ...NOBODY, following: true, muted: true }} />,
    );

    expect(lines(container)[5]).toBe('***   you follow them · muted');
  });

  it('can list all four', () => {
    const { container } = render(
      <WhoisBlock
        {...BASE_PROPS}
        relationships={{ following: true, followedBy: true, blocked: true, muted: true }}
      />,
    );

    expect(lines(container)[5]).toBe('***   you follow them · they follow you · blocked · muted');
  });
});
