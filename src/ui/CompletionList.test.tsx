/**
 * Tests for the suggestion list (WFE-297): one option per row with its name
 * and description, the highlighted option selected, a dim count of the rows
 * that did not fit, hidden while empty, and a click that picks without taking
 * focus from the input.
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

describe(CompletionList, () => {
  it('lists each row as an option with its name and description', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={0}
        rows={rows(vi.fn(), vi.fn())}
      />,
    );

    expect(screen.getByRole('listbox', { name: 'Suggestions' })).toHaveAttribute('id', 'list');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(
      screen.getByRole('option', { name: '/home (/h) — Open your home timeline' }),
    ).toHaveAttribute('id', rowId('list', 0));
  });

  it('marks the highlighted option as selected', () => {
    render(
      <CompletionList
        active={1}
        id="list"
        label="Suggestions"
        more={0}
        rows={rows(vi.fn(), vi.fn())}
      />,
    );

    expect(screen.getByRole('option', { name: /home/u })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: /host/u })).toHaveAttribute('aria-selected', 'true');
  });

  it('counts the rows that did not fit', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={3}
        rows={rows(vi.fn(), vi.fn())}
      />,
    );

    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('counts nothing when everything fits', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={0}
        rows={rows(vi.fn(), vi.fn())}
      />,
    );

    expect(screen.queryByText(/more/u)).not.toBeInTheDocument();
  });

  it('is hidden while it has no rows', () => {
    render(<CompletionList active={-1} id="list" label="Suggestions" more={0} rows={[]} />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { hidden: true })).toBeInTheDocument();
  });

  it('picks the row that is clicked', () => {
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={0}
        rows={rows(first, second)}
      />,
    );

    fireEvent.click(screen.getByRole('option', { name: /host/u }));

    expect(second).toHaveBeenCalledExactlyOnceWith(expect.anything());
    expect(first).not.toHaveBeenCalled();
  });

  it('does not take focus from the input when pressed', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={0}
        rows={rows(vi.fn(), vi.fn())}
      />,
    );

    expect(fireEvent.mouseDown(screen.getByRole('option', { name: /host/u }))).toBe(false);
  });

  it('shows a row without a description as its name alone, with no dash', () => {
    render(
      <CompletionList
        active={-1}
        id="list"
        label="Suggestions"
        more={0}
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
        more={0}
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
