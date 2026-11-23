/**
 * Tests for the sign-up box: every field is labelled and the password asks
 * for `new-password`, sending is held back until the agreement is ticked and
 * hands the typed values over, the instance field appears only on a build
 * that asks for it, the instance's message and field errors (and the ones for
 * fields the form lacks) show up, the two waiting outcomes say what to do, and
 * a signed-in account closes the box.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RegistrationForm } from './RegistrationForm';
import type { RegistrationValues } from './submitRegistration';
import type { RegistrationOutcome } from '../../accounts/registerAccount';

/** The box over an `onSubmit` that answers {@link outcome}; the spies it calls. */
function renderForm(outcome: RegistrationOutcome, askInstance = false) {
  const onSubmit = vi
    .fn<(values: RegistrationValues) => Promise<RegistrationOutcome>>()
    .mockResolvedValue(outcome);
  const onClose = vi.fn();
  render(<RegistrationForm askInstance={askInstance} onClose={onClose} onSubmit={onSubmit} />);
  return { onSubmit, onClose };
}

/** Fill the fields every send needs, tick the agreement and press send. */
function fillAndSend(): void {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'lain' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lain@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } });
  fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'invited' } });
  fireEvent.click(screen.getByLabelText('I agree to the rules and terms of this instance'));
  fireEvent.click(screen.getByRole('button', { name: '[ register ]' }));
}

const AN_ERROR: RegistrationOutcome = {
  kind: 'error',
  message: 'Registration failed: HTTP 422: Validation failed',
  fields: {
    username: ['has already been taken'],
    password: ['is too short', 'is too common'],
    token: ['is invalid'],
  },
};

describe(RegistrationForm, () => {
  it('labels its fields and keeps the password a new password', () => {
    renderForm({ kind: 'approval' });

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.queryByLabelText('Instance')).not.toBeInTheDocument();
  });

  it('asks for the instance on a build that asks', () => {
    renderForm({ kind: 'approval' }, true);

    expect(screen.getByLabelText('Instance')).toBeInTheDocument();
  });

  it('holds sending back until the agreement is ticked', () => {
    renderForm({ kind: 'approval' });
    const send = screen.getByRole('button', { name: '[ register ]' });

    expect(send).toBeDisabled();

    fireEvent.click(screen.getByLabelText('I agree to the rules and terms of this instance'));

    expect(send).toBeEnabled();
  });

  it('hands the typed values over', async () => {
    const { onSubmit } = renderForm({ kind: 'approval' });

    fillAndSend();

    await screen.findByRole('status');

    expect(onSubmit.mock.calls).toStrictEqual([
      [
        {
          instance: '',
          username: 'lain',
          email: 'lain@example.com',
          password: 'correct horse',
          agreement: true,
          reason: 'invited',
        },
      ],
    ]);
  });

  it('shows the failure and its field errors, keeping what was typed', async () => {
    renderForm(AN_ERROR);

    fillAndSend();

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Registration failed: HTTP 422: Validation failed');
    expect(screen.getByText('has already been taken')).toBeInTheDocument();
    expect(screen.getByText('is too short, is too common')).toBeInTheDocument();
    expect(screen.getByText('token: is invalid')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInvalid();
  });

  it('keeps what was typed after a failure', async () => {
    renderForm(AN_ERROR);

    fillAndSend();
    await screen.findByRole('alert');

    expect(screen.getByLabelText('Username')).toHaveValue('lain');
  });

  it.each([
    ['confirmation', /check your email/iu],
    ['approval', /awaiting approval/iu],
  ] as const)('says what a %s outcome needs, and closes on request', async (kind, message) => {
    const { onClose } = renderForm({ kind });

    fillAndSend();

    const notice = await screen.findByRole('status');

    expect(notice).toHaveTextContent(message);

    fireEvent.click(screen.getByRole('button', { name: '[ close ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('closes when the account comes signed in', async () => {
    const account = {
      key: 'k',
      origin: 'https://wired.example',
      accountId: '1',
      handle: 'lain@wired.example',
      token: 't',
      refreshToken: null,
      expiresAt: null,
    };
    const { onClose } = renderForm({ kind: 'ok', account });

    fillAndSend();

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledExactlyOnceWith();
    });
  });
});
