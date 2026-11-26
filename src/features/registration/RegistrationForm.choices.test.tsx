/**
 * Tests for the sign-up box's instance on `list` and `open` builds (WFE-307):
 * the listed instances are choices, a free-text field shows only where custom
 * instances are allowed, choosing one sends its origin and a lone origin is
 * preselected.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RegistrationForm } from './RegistrationForm';
import type { RegistrationValues } from './submitRegistration';
import type { RegistrationOutcome } from '../../accounts/registerAccount';
import type { InstanceChoices } from '../../lib/origin';

const TWO = ['https://wired.example', 'https://pleroma.example'];

/** The box on a build offering {@link choices}, with a send that is refused. */
function renderForm(choices: InstanceChoices | null | undefined) {
  const onSubmit = vi
    .fn<(values: RegistrationValues) => Promise<RegistrationOutcome>>()
    .mockResolvedValue({ kind: 'error', message: 'nope', fields: {} });
  render(<RegistrationForm askInstance choices={choices} onClose={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

/** Tick the agreement, press register and wait for the refusal. */
async function send(): Promise<void> {
  fireEvent.click(screen.getByLabelText('I agree to the rules and terms of this instance'));
  fireEvent.click(screen.getByRole('button', { name: '[ register ]' }));
  await screen.findByRole('alert');
}

describe('the sign-up box on a list build', () => {
  it('offers the instances as choices without a free-text field and sends the chosen origin', async () => {
    const onSubmit = renderForm({ origins: TWO, allowCustom: false });

    fireEvent.click(screen.getByRole('radio', { name: 'pleroma.example' }));
    await send();

    expect(screen.getByRole('radio', { name: 'wired.example' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Instance')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Other instance' })).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ instance: 'https://pleroma.example' }),
    );
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

describe('the sign-up box on an open build', () => {
  it.each([null, undefined])('keeps the free-text instance field for %s choices', (choices) => {
    renderForm(choices);

    expect(screen.getByLabelText('Instance')).toHaveAttribute('type', 'text');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
