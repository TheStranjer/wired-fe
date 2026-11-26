/**
 * Tests for the suggestion list (WFE-297): one option per row with its name
 * and description, the highlighted option selected and scrolled into view
 * (WFE-306), every row listed however many there are, hidden while empty, and
 * a click that picks without taking focus from the input.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompletionList, rowId } from './CompletionList';

/** Two rows whose picks are the given spies. */
function rows(
  first: () => void,
  second: () => void,
): readonly { label: string; description: string; pick: () => void }[] {
  return [
    { label: '/home (/h)', description: 'Open your home timeline', pick: first },
    { label: '/host', description: 'Host a thing', pick: second },
  ];
}

/** {@link count} rows, `row0` to `row{count-1}`, that pick nothing. */
function many(count: number): readonly { label: string; description: string; pick: () => void }[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `row${String(index)}`,
    description: '',
    pick: vi.fn(),
  }));
}

/** Shadow a jsdom element's missing scrollIntoView with a recording mock. */
function fakeScrollIntoView(element: HTMLElement | undefined): ReturnType<typeof vi.fn> {
  const scrollIntoView = vi.fn();
  Object.defineProperty(element, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  return scrollIntoView;
}

describe(CompletionList, () => {
  it('lists each row as an option with its name and description', () => {
    render(
      <CompletionList active={-1} id="list" label="Suggestions" rows={rows(vi.fn(), vi.fn())} />,
    );

    expect(screen.getByRole('listbox', { name: 'Suggestions' })).toHaveAttribute('id', 'list');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(
      screen.getByRole('option', { name: '/home (/h) — Open your home timeline' }),
    ).toHaveAttribute('id', rowId('list', 0));
  });

  it('marks the highlighted option as selected', () => {
    render(
      <CompletionList active={1} id="list" label="Suggestions" rows={rows(vi.fn(), vi.fn())} />,
    );

    expect(screen.getByRole('option', { name: /home/u })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: /host/u })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists every row and counts none as left out', () => {
    render(<CompletionList active={-1} id="list" label="Suggestions" rows={many(20)} />);

    expect(screen.getAllByRole('option')).toHaveLength(20);
    expect(screen.queryByText(/more/u)).not.toBeInTheDocument();
  });

  it('scrolls the highlighted option into view when it changes', () => {
    const { rerender } = render(
      <CompletionList active={0} id="list" label="Suggestions" rows={many(20)} />,
    );
    const scrollIntoView = fakeScrollIntoView(screen.getAllByRole('option')[12]);

    rerender(<CompletionList active={12} id="list" label="Suggestions" rows={many(20)} />);

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
  });

  it('scrolls nothing while no option is highlighted', () => {
    const { rerender } = render(
      <CompletionList active={0} id="list" label="Suggestions" rows={many(20)} />,
    );
    const scrollIntoView = fakeScrollIntoView(screen.getAllByRole('option')[0]);

    rerender(<CompletionList active={-1} id="list" label="Suggestions" rows={many(20)} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('is hidden while it has no rows', () => {
    render(<CompletionList active={-1} id="list" label="Suggestions" rows={[]} />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { hidden: true })).toBeInTheDocument();
  });

  it('picks the row that is clicked', () => {
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    render(<CompletionList active={-1} id="list" label="Suggestions" rows={rows(first, second)} />);

    fireEvent.click(screen.getByRole('option', { name: /host/u }));

    expect(second).toHaveBeenCalledExactlyOnceWith(expect.anything());
    expect(first).not.toHaveBeenCalled();
  });

  it('does not take focus from the input when pressed', () => {
    render(
      <CompletionList active={-1} id="list" label="Suggestions" rows={rows(vi.fn(), vi.fn())} />,
    );

    expect(fireEvent.mouseDown(screen.getByRole('option', { name: /host/u }))).toBe(false);
  });

  it('shows a row without a description as its name alone, with no dash', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        rows={[{ label: '#zen', description: '', pick: vi.fn() }]}
      />,
    );

    expect(screen.getByRole('option')).toHaveTextContent(/^#zen$/u);
  });

  it('shows the image of a row before its name, named by it', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        rows={[
          {
            label: ':fox:',
            description: '',
            image: 'https://wired.example/e/fox.png',
            pick: vi.fn(),
          },
          { label: ':owl:', description: '', pick: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: ':fox:' })).toHaveAttribute(
      'src',
      'https://wired.example/e/fox.png',
    );
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
