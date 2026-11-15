/**
 * Tests for the quote line: the indented `┌` with label, nick and excerpt in
 * order, the label left out when the quote has none, the aria-hidden glyph and
 * the nick as plain unclickable text.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuoteBlock } from './QuoteBlock';
import type { QuoteBlockProps } from './QuoteBlock';

const BASE_PROPS: QuoteBlockProps = {
  label: 'a4',
  author: { handle: 'bob', fullHandle: '@bob@m.example' },
  excerpt: 'present day, present time…',
};

describe(QuoteBlock, () => {
  it('renders the glyph, label, nick and excerpt as one indented line', () => {
    const { container } = render(<QuoteBlock {...BASE_PROPS} />);

    expect(container.textContent).toBe('     ┌ [a4] <bob> present day, present time…');
  });

  it('leaves the label out when the quote has none', () => {
    const { container } = render(<QuoteBlock {...BASE_PROPS} label={null} />);

    expect(container.textContent).toBe('     ┌ <bob> present day, present time…');
    expect(container.textContent).not.toContain('[]');
  });

  it('hides the tree glyph from assistive technology', () => {
    const { getByText } = render(<QuoteBlock {...BASE_PROPS} />);

    expect(getByText('┌')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the author as a plain nick, never a button', () => {
    const { container, getByTitle } = render(<QuoteBlock {...BASE_PROPS} />);

    expect(container.querySelector('button')).toBeNull();
    expect(getByTitle('@bob@m.example')).toHaveTextContent('bob');
  });

  it('renders the excerpt as text, markup never surviving to the DOM', () => {
    const { container } = render(<QuoteBlock {...BASE_PROPS} excerpt="<b>bold</b>" />);

    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>bold</b>');
  });
});
