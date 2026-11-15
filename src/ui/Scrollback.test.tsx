import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { adjustedScrollTop, isAtBottom, Scrollback } from './Scrollback';

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

/** One keyed div per line, the shape BufferView hands {@link Scrollback}. */
function lineKeys(...keys: readonly string[]) {
  return keys.map((key) => <div key={key}>{key}</div>);
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

describe(adjustedScrollTop, () => {
  it('moves the view down by the height older lines added above it', () => {
    expect(adjustedScrollTop(500, 700, 200)).toBe(400);
  });

  it('moves the view up by the height lines above it took away', () => {
    expect(adjustedScrollTop(700, 500, 400)).toBe(200);
  });

  it('holds the position when the height did not change', () => {
    expect(adjustedScrollTop(500, 500, 200)).toBe(200);
  });

  it('never sends the view above the top', () => {
    expect(adjustedScrollTop(700, 100, 200)).toBe(0);
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

  it('asks for older lines when the user scrolls to the very top', () => {
    const onReachTop = vi.fn();
    render(
      <Scrollback label="home timeline" onReachTop={onReachTop}>
        {lineKeys('a', 'b')}
      </Scrollback>,
    );
    const element = screen.getByRole('log', { name: 'home timeline' });

    // Mounting is not a scroll, however short the buffer is.
    expect(onReachTop).not.toHaveBeenCalled();

    fakeGeometry(element, metrics(0, 100, 500));
    fireEvent.scroll(element);

    expect(onReachTop).toHaveBeenCalledTimes(1);
  });

  it('says nothing while a scroll stops short of the top', () => {
    const onReachTop = vi.fn();
    render(
      <Scrollback label="home timeline" onReachTop={onReachTop}>
        {lineKeys('a')}
      </Scrollback>,
    );
    const element = screen.getByRole('log', { name: 'home timeline' });

    fakeGeometry(element, metrics(200, 100, 500));
    fireEvent.scroll(element);

    expect(onReachTop).not.toHaveBeenCalled();
  });

  it('keeps the reading position when older lines arrive above the first line', () => {
    const view = render(<Scrollback label="home timeline">{lineKeys('a', 'b')}</Scrollback>);
    const element = screen.getByRole('log', { name: 'home timeline' });

    fakeGeometry(element, metrics(200, 100, 500));
    fireEvent.scroll(element);
    // jsdom has no layout, so the height the view measures only becomes real by
    // faking it and committing once: that render is the "before" of the page.
    view.rerender(<Scrollback label="home timeline">{lineKeys('a', 'b')}</Scrollback>);

    fakeGeometry(element, metrics(200, 100, 700));
    view.rerender(<Scrollback label="home timeline">{lineKeys('older', 'a', 'b')}</Scrollback>);

    expect(element.scrollTop).toBe(400);
  });

  it('leaves the view alone when lines join below while the first line stays', () => {
    const view = render(<Scrollback label="home timeline">{lineKeys('a', 'b')}</Scrollback>);
    const element = screen.getByRole('log', { name: 'home timeline' });

    fakeGeometry(element, metrics(200, 100, 500));
    fireEvent.scroll(element);
    view.rerender(<Scrollback label="home timeline">{lineKeys('a', 'b')}</Scrollback>);

    fakeGeometry(element, metrics(200, 100, 700));
    view.rerender(<Scrollback label="home timeline">{lineKeys('a', 'b', 'newer')}</Scrollback>);

    // The first line is still `a`: the new line joined below, so the view keeps
    // the position the reader scrolled to rather than being pushed about.
    expect(element.scrollTop).toBe(200);
  });
});
