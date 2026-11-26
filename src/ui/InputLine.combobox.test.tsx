/**
 * Tests for the command line as a combobox (WFE-297): it points at the list it
 * controls, says whether it is expanded and names the highlighted option, draws
 * the list handed to it, and tells its parent where the caret is after an edit,
 * a key release or a click.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InputLine } from './InputLine';

/** The command line with the given extra props. */
function Line(props: Partial<ComponentProps<typeof InputLine>>): JSX.Element {
  return (
    <InputLine
      prompt=">"
      value="/ho"
      onChange={() => undefined}
      onSubmit={() => undefined}
      {...props}
    />
  );
}

/** The combobox under test. */
function line(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Command line' });
}

describe('InputLine as a combobox', () => {
  it('controls the list and names the highlighted option', () => {
    render(<Line activeId="list-1" expanded listId="list" popup={<div id="list" />} />);

    expect(line()).toHaveAttribute('aria-controls', 'list');
    expect(line()).toHaveAttribute('aria-expanded', 'true');
    expect(line()).toHaveAttribute('aria-activedescendant', 'list-1');
    expect(line()).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('is collapsed with nothing highlighted', () => {
    render(<Line expanded={false} listId="list" />);

    expect(line()).toHaveAttribute('aria-expanded', 'false');
    expect(line()).not.toHaveAttribute('aria-activedescendant');
  });

  it('draws the popup it is given', () => {
    render(<Line popup={<p>the list</p>} />);

    expect(screen.getByText('the list')).toBeInTheDocument();
  });

  it('reports the input after an edit, a key release and a click', () => {
    const onCaret = vi.fn<(input: HTMLInputElement) => void>();
    render(<Line onCaret={onCaret} />);

    fireEvent.change(line(), { target: { value: '/hom' } });
    fireEvent.keyUp(line(), { key: 'ArrowLeft' });
    fireEvent.click(line());

    expect(onCaret).toHaveBeenCalledTimes(3);
    expect(onCaret).toHaveBeenCalledWith(line());
  });

  it('works without anyone listening for the caret', () => {
    render(<Line />);

    fireEvent.keyUp(line(), { key: 'ArrowLeft' });
    fireEvent.click(line());

    expect(line()).toHaveValue('/ho');
  });
});
