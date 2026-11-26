/**
 * Tests for the media review dialog (WFE-290): a wide, labelled modal that
 * lists every attachment with its thumbnail or name and a textarea labelled
 * `Description for <file>`, prefilled; rows without a description are marked
 * by a tag as well as `aria-invalid`, and focus opens on the first of them; the
 * dialog says how many have none; Submit and Enter hand back every description
 * typed (Shift+Enter adds a line instead); Cancel and Escape hand back the same
 * and call `onCancel`; and many rows are all rendered, the list scrolling
 * inside the box.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaReviewDialog, type ReviewItem } from './MediaReviewDialog';

/** A ready line named after {@link name}, with {@link description} and an optional thumbnail. */
function line(name: string, description: string, previewUrl: string | null = null): ReviewItem {
  return { key: `k-${name}`, name, previewUrl, description };
}

/** The textarea of the file {@link name}. */
function field(name: string): HTMLElement {
  return screen.getByRole('textbox', { name: `Description for ${name}` });
}

/** Render the dialog over {@link items} with recording callbacks. */
function renderDialog(items: readonly ReviewItem[]): {
  readonly onSubmit: ReturnType<typeof vi.fn>;
  readonly onCancel: ReturnType<typeof vi.fn>;
} {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<MediaReviewDialog items={items} onCancel={onCancel} onSubmit={onSubmit} />);
  return { onSubmit, onCancel };
}

const THREE = [
  line('a.png', 'a cat', 'https://wired.example/a.png'),
  line('b.png', ''),
  line('c.png', '  '),
];

describe(MediaReviewDialog, () => {
  it('is a dialog named Describe media that says how many have no description', () => {
    renderDialog(THREE);

    expect(screen.getByRole('dialog', { name: 'Describe media' })).toHaveAccessibleDescription(
      '2 of 3 attachments have no description',
    );
  });

  it('lists every attachment with its textarea prefilled, and the thumbnail when there is one', () => {
    renderDialog(THREE);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(field('a.png')).toHaveValue('a cat');
    expect(screen.getByText('c.png')).toBeInTheDocument();
    expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://wired.example/a.png');
  });

  it('marks the ones with no description by a tag and aria-invalid', () => {
    renderDialog(THREE);

    expect(field('a.png')).toBeValid();
    expect(field('b.png')).toBeInvalid();
    expect(field('c.png')).toBeInvalid();
    expect(screen.getAllByText('no description')).toHaveLength(2);
  });

  it('drops the mark once a description is typed', () => {
    renderDialog(THREE);

    fireEvent.change(field('b.png'), { target: { value: 'a dog' } });

    expect(field('b.png')).toBeValid();
    expect(screen.getAllByText('no description')).toHaveLength(1);
  });

  it('focuses the first attachment without a description', () => {
    renderDialog(THREE);

    expect(field('b.png')).toHaveFocus();
  });

  it('keeps the focus on the first field when every attachment is described', () => {
    renderDialog([line('a.png', 'a cat'), line('b.png', 'a dog')]);

    expect(field('a.png')).toHaveFocus();
  });

  it('submits every description, edited or not, with the button', () => {
    const { onSubmit } = renderDialog(THREE);
    fireEvent.change(field('b.png'), { target: { value: 'a dog' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      new Map([
        ['k-a.png', 'a cat'],
        ['k-b.png', 'a dog'],
        ['k-c.png', '  '],
      ]),
    );
  });

  it('submits with Enter in a textarea', () => {
    const { onSubmit } = renderDialog(THREE);
    fireEvent.change(field('b.png'), { target: { value: 'a dog' } });

    fireEvent.keyDown(field('b.png'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on Shift+Enter or another key in a textarea', () => {
    const { onSubmit } = renderDialog(THREE);

    fireEvent.keyDown(field('b.png'), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field('b.png'), { key: 'a' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels with the button, handing back what was typed', () => {
    const { onSubmit, onCancel } = renderDialog(THREE);
    fireEvent.change(field('b.png'), { target: { value: 'a dog' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith(
      new Map([
        ['k-a.png', 'a cat'],
        ['k-b.png', 'a dog'],
        ['k-c.png', '  '],
      ]),
    );
  });

  it('cancels on Escape', () => {
    const { onSubmit, onCancel } = renderDialog(THREE);

    fireEvent.keyDown(field('b.png'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders every row of a long list', () => {
    const many = Array.from({ length: 30 }, (_, index) => line(`f${String(index)}.png`, ''));
    renderDialog(many);

    expect(screen.getAllByRole('textbox')).toHaveLength(30);
    expect(screen.getByRole('dialog', { name: 'Describe media' })).toHaveAccessibleDescription(
      '30 of 30 attachments have no description',
    );
  });
});
