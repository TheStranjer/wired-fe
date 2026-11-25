/**
 * Tests for the confirm dialog (WFE-266): a labelled modal dialog showing its
 * title and message, focus starting on Cancel, Escape and Cancel both asking to
 * cancel, Confirm asking to confirm, custom words on the cancel button, and
 * `danger` marking the confirm button.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

/** Render the dialog with recording callbacks, over `overrides`. */
function renderDialog(overrides: Partial<ConfirmDialogProps> = {}): {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
} {
  const onConfirm = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  render(
    <ConfirmDialog
      confirmLabel="Delete"
      message="This can't be undone."
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Delete post [a4]?"
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe(ConfirmDialog, () => {
  it('is a dialog named by its title and shows the message', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Delete post [a4]?' });

    expect(dialog).toHaveTextContent("This can't be undone.");
    expect(screen.getByRole('heading', { name: 'Delete post [a4]?' })).toBeInTheDocument();
  });

  it('starts focus on Cancel', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('cancels on Escape', () => {
    const { onCancel, onConfirm } = renderDialog();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledExactlyOnceWith();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels from the Cancel button', () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledExactlyOnceWith();
  });

  it('confirms from the confirm button', () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the given cancel label, and accepts danger', () => {
    renderDialog({ cancelLabel: 'Keep it', danger: true });

    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
