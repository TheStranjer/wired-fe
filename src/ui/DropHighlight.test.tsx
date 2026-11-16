/**
 * Tests for the drop highlight: the exact call to action is rendered as the
 * overlay's text, and the whole thing is hidden from assistive technology
 * because it only decorates the live UI underneath.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DropHighlight } from './DropHighlight';

describe(DropHighlight, () => {
  it('shows the drop call to action', () => {
    render(<DropHighlight />);

    expect(screen.getByText('-- drop to attach --')).toHaveTextContent('-- drop to attach --');
  });

  it('is hidden from assistive technology', () => {
    render(<DropHighlight />);

    expect(screen.getByText('-- drop to attach --')).toHaveAttribute('aria-hidden', 'true');
  });
});
