/**
 * Tests for the new-password box: both fields are labelled new-password
 * inputs, the instance field appears only on a build that asks for it, a send
 * hands the typed values over, a success says so and closes on request, and a
 * failure shows its message.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordResetForm } from './PasswordResetForm';
import type { PasswordResetOutcome, PasswordResetValues } from './submitPasswordReset';

/** The box over an `onSubmit` that answers {@link outcome}; the spies it calls. */
function renderForm(outcome: PasswordResetOutcome, askInstance = false) {
  const onSubmit = vi
    .fn<(values: PasswordResetValues) => Promise<PasswordResetOutcome>>()
    .mockResolvedValue(outcome);
  const onClose = vi.fn();
  render(<PasswordResetForm askInstance={askInstance} onClose={onClose} onSubmit={onSubmit} />);
  return { onSubmit, onClose };
}

/** Fill the fields and press send. */
function fillAndSend(): void {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'correct horse' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'correct horse' },
  });
  fireEvent.click(screen.getByRole('button', { name: '[ reset password ]' }));
}

describe(PasswordResetForm, () => {
  it('has no instance field on a build that knows its instance', () => {
    renderForm({ kind: 'ok' });

    expect(screen.queryByLabelText('Instance')).not.toBeInTheDocument();
  });

  it('asks for the instance on a build that asks and hands it over', async () => {
    const { onSubmit } = renderForm({ kind: 'ok' }, true);
    fireEvent.change(screen.getByLabelText('Instance'), { target: { value: 'wired.example' } });

    fillAndSend();
    await screen.findByRole('status');

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      instance: 'wired.example',
      password: 'correct horse',
      confirmation: 'correct horse',
    });
  });

  it('says the password is changed and closes on request', async () => {
    const { onClose } = renderForm({ kind: 'ok' });

    fillAndSend();
    const notice = await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: '[ close ]' }));

    expect(notice).toHaveTextContent('Password changed');
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('shows a failure and keeps the form for another try', async () => {
    renderForm({ kind: 'error', message: 'Invalid token' });

    fillAndSend();
    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Invalid token');
    expect(screen.getByRole('button', { name: '[ reset password ]' })).toBeEnabled();
  });
});
