/**
 * Tests for the new-password box's instance on `list` and `open` builds
 * (WFE-307): the listed instances are choices, a free-text field shows only
 * where custom instances are allowed, choosing one sends its origin and a lone
 * origin is preselected, also after a success.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordResetForm } from './PasswordResetForm';
import type { PasswordResetOutcome, PasswordResetValues } from './submitPasswordReset';
import type { InstanceChoices } from '../../lib/origin';

const TWO = ['https://wired.example', 'https://pleroma.example'];

/** The box on a build offering {@link choices}, with a send that fails. */
function renderForm(choices: InstanceChoices | null | undefined) {
  const onSubmit = vi
    .fn<(values: PasswordResetValues) => Promise<PasswordResetOutcome>>()
    .mockResolvedValue({ kind: 'error', message: 'nope' });
  render(<PasswordResetForm askInstance choices={choices} onClose={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

/** Fill the passwords, press send and wait for the refusal. */
async function send(): Promise<void> {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'correct horse' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'correct horse' },
  });
  fireEvent.click(screen.getByRole('button', { name: '[ reset password ]' }));
  await screen.findByRole('alert');
}

describe('the new-password box on a list build', () => {
  it('offers the instances as choices without a free-text field and sends the chosen origin', async () => {
    const onSubmit = renderForm({ origins: TWO, allowCustom: false });

    fireEvent.click(screen.getByRole('radio', { name: 'pleroma.example' }));
    await send();

    expect(screen.getByRole('radio', { name: 'wired.example' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Instance')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Other instance' })).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      instance: 'https://pleroma.example',
      password: 'correct horse',
      confirmation: 'correct horse',
    });
  });

  it('adds a free-text field where custom instances are allowed', async () => {
    const onSubmit = renderForm({ origins: TWO, allowCustom: true });

    fireEvent.change(screen.getByRole('textbox', { name: 'Other instance' }), {
      target: { value: 'other.example' },
    });
    await send();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ instance: 'other.example' }));
  });

  it('preselects the only listed instance', async () => {
    const onSubmit = renderForm({ origins: ['https://wired.example'], allowCustom: false });
    await send();

    expect(screen.getByRole('radio', { name: 'wired.example' })).toBeChecked();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ instance: 'https://wired.example' }),
    );
  });
});

describe('the new-password box on an open build', () => {
  it.each([null, undefined])('keeps the free-text instance field for %s choices', (choices) => {
    renderForm(choices);

    expect(screen.getByLabelText('Instance')).toHaveAttribute('type', 'text');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
