/**
 * Tests for the invite sign-up in the running shell (WFE-166): a page loaded
 * at `/registration/<token>` (or a hash change to it) opens the box with
 * nobody signed in, Escape closes it, a send registers with the invite as
 * `token` and tells the visitor to confirm their address or wait for approval,
 * the instance's field errors and an invalid-invite refusal show up in the box,
 * and the password never reaches the command line. The real startup runs (it
 * is what turns the path into the hash); the instance is answered over MSW.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';
import { mockRegistration } from '../test/registrationServer';

/** The origin the page is on; a same-origin build registers here. */
const PAGE = window.location.origin;

/** Render the shell at {@link url}, nobody signed in. */
function open(url: string): void {
  window.history.replaceState(null, '', url);
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
}

/** Fill the form in with a username, an address and a password, tick the agreement and send. */
function fillAndSend(): void {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'lain' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lain@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } });
  fireEvent.click(screen.getByLabelText('I agree to the rules and terms of this instance'));
  fireEvent.click(screen.getByRole('button', { name: '[ register ]' }));
}

describe('the invite sign-up', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('opens from the path and takes the route out of the address bar', async () => {
    open('/registration/invite-1');

    const dialog = await screen.findByRole('dialog', { name: 'Sign up' });

    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('opens when the hash changes to an invite, and Escape closes it', async () => {
    open('/');
    window.history.replaceState(null, '', '/#/registration/invite-2');
    fireEvent(window, new HashChangeEvent('hashchange'));

    const dialog = await screen.findByRole('dialog', { name: 'Sign up' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open for an ordinary page', async () => {
    open('/');
    await screen.findByText('Present day. Present time.');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('registers with the invite as token and tells a visitor awaiting approval so', async () => {
    const seen = mockRegistration({ accounts: { body: { approval_required: true } } }, PAGE);
    open('/registration/invite-1');
    await screen.findByRole('dialog', { name: 'Sign up' });

    fillAndSend();

    const notice = await screen.findByRole('status');

    expect(notice).toHaveTextContent(/awaiting approval/iu);
    expect(seen.body).toMatchObject({
      username: 'lain',
      email: 'lain@example.com',
      password: 'hunter2hunter2',
      agreement: true,
      locale: 'en',
      token: 'invite-1',
    });
    expect(seen.auth).toBe('Bearer app-token');
    expect(screen.getByRole('combobox', { name: 'Command line' })).toHaveValue('');
  });

  it('tells a visitor whose address needs confirming to check their email', async () => {
    mockRegistration({ accounts: { body: { confirmation_required: true } } }, PAGE);
    open('/registration/invite-1');
    await screen.findByRole('dialog', { name: 'Sign up' });

    fillAndSend();

    const notice = await screen.findByRole('status');

    expect(notice).toHaveTextContent(/check your email/iu);
  });

  it('shows the instance’s 422 field errors', async () => {
    mockRegistration(
      {
        accounts: {
          status: 422,
          body: {
            error: 'Validation failed: Username has already been taken',
            details: { username: [{ error: 'ERR_TAKEN', description: 'has already been taken' }] },
          },
        },
      },
      PAGE,
    );
    open('/registration/invite-1');
    await screen.findByRole('dialog', { name: 'Sign up' });

    fillAndSend();

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Validation failed');
    expect(screen.getByText('has already been taken')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInvalid();
  });

  it('shows an invalid invite', async () => {
    mockRegistration(
      { accounts: { status: 422, body: { error: 'Invite token is invalid or expired' } } },
      PAGE,
    );
    open('/registration/stale');
    await screen.findByRole('dialog', { name: 'Sign up' });

    fillAndSend();

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Invite token is invalid or expired');
  });
});
