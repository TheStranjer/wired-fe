/**
 * Tests for the pane frame: it shows title, subtitle and topic, marks focus
 * with `[*]` and `aria-current` only when focused, asks for focus on a
 * pointer-down anywhere inside (content included), renders its actions slot
 * and passes a title-bar pointer handler through.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PaneFrame } from './PaneFrame';
import type { PaneFrameProps } from './PaneFrame';

/** A frame with every optional part present, overridable per test. */
function Frame(props: Partial<PaneFrameProps>): JSX.Element {
  return (
    <PaneFrame
      actions={<button type="button">close</button>}
      focused={false}
      onFocusRequest={vi.fn()}
      subtitle="@lain@wired.example"
      title="#home"
      topic="the wired"
      {...props}
    >
      <p>content</p>
    </PaneFrame>
  );
}

describe(PaneFrame, () => {
  it('shows the title, subtitle and topic', () => {
    render(<Frame />);

    expect(screen.getByText(/#home/)).toHaveTextContent('#home @lain@wired.example — the wired');
    expect(screen.getByRole('region', { name: '#home @lain@wired.example' })).toBeVisible();
  });

  it('drops a missing subtitle and topic', () => {
    render(<Frame subtitle={null} topic={null} />);

    expect(screen.getByRole('region', { name: '#home' })).toHaveTextContent(/^#home\s*close/);
  });

  it('marks focus with [*] and aria-current only when focused', () => {
    const view = render(<Frame />);

    expect(screen.queryByText(/\[\*\]/)).toBeNull();
    expect(screen.getByRole('region')).not.toHaveAttribute('aria-current');

    view.rerender(<Frame focused />);

    expect(screen.getByText(/\[\*\]/)).toBeVisible();
    expect(screen.getByRole('region')).toHaveAttribute('aria-current', 'true');
  });

  it('asks for focus on a pointer-down in the content', () => {
    const onFocusRequest = vi.fn();
    render(<Frame onFocusRequest={onFocusRequest} />);

    fireEvent.pointerDown(screen.getByText('content'));

    expect(onFocusRequest).toHaveBeenCalledTimes(1);
  });

  it('renders the actions slot', () => {
    render(<Frame />);

    expect(screen.getByRole('button', { name: 'close' })).toBeVisible();
  });

  it('passes a pointer-down handler through to the title bar', () => {
    const onPointerDown = vi.fn();
    render(<Frame titleBarProps={{ onPointerDown }} />);

    fireEvent.pointerDown(screen.getByText(/#home/));

    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });
});
