/**
 * Tests for the modal box: it is a labelled aria-modal dialog, focus lands on
 * its first field as it opens and walks back out of the last field to the
 * element that held focus before, Tab wraps from the last field to the first
 * and Shift+Tab from the first to the last, Escape asks to close, and a box
 * with no fields still takes focus and lets the keyboard alone.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Overlay } from './Overlay';

/** Outside button, then the box over two fields while open. */
function Host(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        outside
      </button>
      {open ? (
        <Overlay
          label="Compose"
          onClose={() => {
            setOpen(false);
          }}
        >
          <input aria-label="first field" />
          <button type="button">last field</button>
        </Overlay>
      ) : null}
    </>
  );
}

/** Opens the box from the outside button, which held focus before. */
function openHost(): HTMLElement {
  render(<Host />);
  const outside = screen.getByRole('button', { name: 'outside' });
  act(() => {
    outside.focus();
  });
  fireEvent.click(outside);
  return outside;
}

/** The box's two fields. */
function fields(): [HTMLInputElement, HTMLButtonElement] {
  return [
    screen.getByRole('textbox', { name: 'first field' }),
    screen.getByRole('button', { name: 'last field' }),
  ];
}

describe(Overlay, () => {
  it('is a labelled modal dialog', () => {
    openHost();

    const dialog = screen.getByRole('dialog', { name: 'Compose' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('focuses its first field as it opens', () => {
    openHost();
    const [first] = fields();

    expect(first).toHaveFocus();
  });

  it('wraps Tab from the last field back to the first', () => {
    openHost();
    const [first, last] = fields();
    act(() => {
      last.focus();
    });

    fireEvent.keyDown(last, { key: 'Tab' });

    expect(first).toHaveFocus();
  });

  it('wraps Shift+Tab from the first field back to the last', () => {
    openHost();
    const [first, last] = fields();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

    expect(last).toHaveFocus();
  });

  it('leaves Tab alone between two inner fields', () => {
    openHost();
    const [first, last] = fields();
    act(() => {
      first.focus();
    });

    const notPrevented = fireEvent.keyDown(first, { key: 'Tab' });

    expect(notPrevented).toBe(true);
    expect(first).toHaveFocus();
    expect(last).not.toHaveFocus();
  });

  it('closes on Escape', () => {
    openHost();
    const [first] = fields();

    fireEvent.keyDown(first, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the element held before closing', () => {
    const outside = openHost();
    const [first] = fields();

    fireEvent.keyDown(first, { key: 'Escape' });

    expect(outside).toHaveFocus();
  });

  it('returns focus to the element held before, when something else closes the box', () => {
    const noop = (): void => undefined;

    function Boxed(props: { readonly open: boolean }): JSX.Element {
      return (
        <>
          <button aria-label="outside" type="button">
            outside
          </button>
          {props.open ? (
            <Overlay label="Compose" onClose={noop}>
              <input aria-label="first field" />
            </Overlay>
          ) : null}
        </>
      );
    }
    const view = render(<Boxed open={false} />);
    const outside = screen.getByRole('button', { name: 'outside' });
    act(() => {
      outside.focus();
    });

    view.rerender(<Boxed open />);

    expect(screen.getByRole('textbox', { name: 'first field' })).toHaveFocus();

    view.rerender(<Boxed open={false} />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outside).toHaveFocus();
  });

  it('takes focus itself and traps nothing when it holds no fields', () => {
    const onClose = vi.fn();
    render(
      <Overlay label="Read" onClose={onClose}>
        <p>nothing to focus</p>
      </Overlay>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Read' });
    const notPrevented = fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(notPrevented).toBe(true);

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is a dialog of the wider size too (WFE-290)', () => {
    render(
      <Overlay label="Describe media" onClose={vi.fn()} size="wide">
        <input aria-label="field" />
      </Overlay>,
    );

    expect(screen.getByRole('dialog', { name: 'Describe media' })).toContainElement(
      screen.getByRole('textbox', { name: 'field' }),
    );
  });
});
