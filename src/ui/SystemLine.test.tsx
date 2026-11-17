/**
 * Tests for the system line: the clock, marker and text as one plain-text
 * line, HTML in the text never becoming markup, the screen-reader prefixes
 * that mark warn and error lines, and the actor handle a line can lead with
 * as a click target.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SystemLine } from './SystemLine';
import type { SystemLineProps } from './SystemLine';

const BASE_PROPS: SystemLineProps = {
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  level: 'info',
  text: 'Unknown command: /fsv. Try /help',
};

describe(SystemLine, () => {
  it('renders the time, the *** marker and the text in order', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} />);

    expect(screen.getByText('23:04')).toBeInTheDocument();
    expect(screen.getByText('***')).toBeInTheDocument();
    expect(screen.getByText(BASE_PROPS.text)).toBeInTheDocument();
    expect(container.textContent).toBe(`23:04 *** ${BASE_PROPS.text}`);
  });

  it('hides the marker from assistive technology', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(screen.getByText('***').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows markup in the text literally, as no elements', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} text="<b>x</b>" />);

    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('announces error lines with a hidden Error: prefix', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} level="error" text="boom" />);

    expect(container.textContent).toBe('23:04 *** Error: boom');
  });

  it('announces warn lines with a hidden Warning: prefix', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} level="warn" text="careful" />);

    expect(container.textContent).toBe('23:04 *** Warning: careful');
  });

  it('adds no prefix for info lines', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} text="done" />);

    expect(container.textContent).toBe('23:04 *** done');
  });

  it('formats the clock with the given clockFormat', () => {
    render(<SystemLine {...BASE_PROPS} clockFormat="12h" />);

    expect(screen.getByText('11:04pm')).toBeInTheDocument();
  });

  it('leads the text with a clickable actor handle when one is given', () => {
    const onSelect = vi.fn<() => void>();
    const { container } = render(
      <SystemLine
        {...BASE_PROPS}
        level="info"
        text="followed you"
        actor={{ handle: '@nine@wired.example', onSelect }}
      />,
    );

    expect(container.textContent).toBe('23:04 *** @nine@wired.example followed you');

    fireEvent.click(screen.getByRole('button', { name: '@nine@wired.example' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('hides a decorative line whole from assistive technology', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} decorative text="█▀▀▀▀▄" />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves an ordinary line visible to assistive technology', () => {
    const { container } = render(<SystemLine {...BASE_PROPS} text="done" />);

    expect(container.firstElementChild).not.toHaveAttribute('aria-hidden');
  });
});
