import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { isAtBottom, Scrollback } from './Scrollback';

/** Metrics for a scrolled element, as a browser would report them. */
function metrics(scrollTop: number, clientHeight: number, scrollHeight: number) {
  return { scrollTop, clientHeight, scrollHeight };
}

/**
 * Shadows the scroll metrics of a jsdom element: jsdom has no layout, so
 * every metric is 0 unless the test says otherwise.
 */
function fakeGeometry(
  element: HTMLElement,
  { scrollTop, clientHeight, scrollHeight }: ReturnType<typeof metrics>,
): void {
  Object.defineProperties(element, {
    scrollTop: { configurable: true, value: scrollTop, writable: true },
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

describe(isAtBottom, () => {
  it('is true when the view sits exactly at the bottom', () => {
    expect(isAtBottom(metrics(900, 100, 1000))).toBe(true);
  });

  it('is true four pixels above the bottom with the default threshold', () => {
    expect(isAtBottom(metrics(896, 100, 1000))).toBe(true);
  });

  it('is false five pixels above the bottom with the default threshold', () => {
    expect(isAtBottom(metrics(895, 100, 1000))).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(isAtBottom(metrics(890, 100, 1000), 10)).toBe(true);
    expect(isAtBottom(metrics(889, 100, 1000), 10)).toBe(false);
    expect(isAtBottom(metrics(100, 100, 1000), 800)).toBe(true);
  });
});

describe(Scrollback, () => {
  it('is a labelled live log region showing its lines', () => {
    render(
      <Scrollback label="home timeline">
        <p>hello fediverse</p>
      </Scrollback>,
    );

    const log = screen.getByRole('log', { name: 'home timeline' });

    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('tabindex', '0');
    expect(log).toHaveAccessibleName('home timeline');
    expect(screen.getByText('hello fediverse')).toBeInTheDocument();
  });

  it('sticks to the bottom when new lines arrive', () => {
    const view = render(<Scrollback label="home timeline">one</Scrollback>);
    const element = screen.getByRole('log', { name: 'home timeline' });
    const setScrollTop = vi.spyOn(element, 'scrollTop', 'set');

    view.rerender(<Scrollback label="home timeline">two</Scrollback>);

    // jsdom has no layout, so the bottom is at 0: what is asserted is the
    // assignment of the bottom position, not real scrolling.
    expect(setScrollTop).toHaveBeenCalledWith(element.scrollHeight);
  });

  it('stops following once the user has scrolled up', () => {
    const view = render(<Scrollback label="home timeline">one</Scrollback>);
    const element = screen.getByRole('log', { name: 'home timeline' });
    fakeGeometry(element, metrics(0, 100, 500));

    fireEvent.scroll(element);
    view.rerender(<Scrollback label="home timeline">two</Scrollback>);

    expect(element.scrollTop).toBe(0);
  });

  it('follows again when the user returns to the bottom', () => {
    const view = render(<Scrollback label="home timeline">one</Scrollback>);
    const element = screen.getByRole('log', { name: 'home timeline' });
    fakeGeometry(element, metrics(400, 100, 500));

    fireEvent.scroll(element);
    view.rerender(<Scrollback label="home timeline">two</Scrollback>);

    expect(element.scrollTop).toBe(500);
  });
});
