/**
 * Tests for the external-login registration box over the shared MSW server:
 * the provider's details are prefilled, a send posts them (and the password
 * only when typed) and navigates to the returned address, a pending answer
 * says what the account waits for, a 422 shows inline and leaves the form
 * usable, an unsafe address is refused, and a bad state shows why with a way out.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { RegisterBox } from './RegisterBox';
import { DETAILS, ORIGIN, mockExternal } from '../../test/externalServer';
import { server } from '../../test/server';

/** Render the box for the test login and wait for the form. */
async function open(onClose = vi.fn(), navigate = vi.fn()): Promise<void> {
  render(<RegisterBox navigate={navigate} onClose={onClose} origin={ORIGIN} state="st-1" />);
  await screen.findByRole('form', { name: 'Register' });
}

/** Click the register button. */
function register(): void {
  fireEvent.click(screen.getByRole('button', { name: '[ register ]' }));
}

describe('the external registration box', () => {
  it('prefills the details the provider gave', async () => {
    const seen = mockExternal();

    await open();

    expect(seen.query?.get('state')).toBe('st-1');
    expect(screen.getByLabelText('Nickname')).toHaveValue('lain');
    expect(screen.getByLabelText('Email')).toHaveValue('lain@example.com');
    expect(screen.getByLabelText('Password (optional)')).toHaveValue('');
    expect(screen.getByText(/Signed in with github as Lain Iwakura/u)).toBeInTheDocument();
  });

  it('puts focus on the first field', async () => {
    mockExternal();

    await open();

    expect(screen.getByLabelText('Nickname')).toHaveFocus();
  });

  it('copes with a provider that gave no name', async () => {
    mockExternal({ details: { body: { nickname: 'lain' } } });

    await open();

    expect(screen.getByText(/Signed in with your provider\./u)).toBeInTheDocument();
  });

  it('sends the edited form and navigates to the returned address', async () => {
    const seen = mockExternal();
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: ' wired ' } });
    fireEvent.change(screen.getByLabelText('Password (optional)'), { target: { value: 'pw' } });
    register();

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent('Continuing');
    expect(seen.registered).toStrictEqual({
      state: 'st-1',
      nickname: 'wired',
      email: DETAILS.email,
      password: 'pw',
    });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc');
  });

  it('leaves the password out when none was typed', async () => {
    const seen = mockExternal();
    await open();

    register();
    await screen.findByRole('status');

    expect(seen.registered).toStrictEqual({
      state: 'st-1',
      nickname: 'lain',
      email: DETAILS.email,
    });
  });

  it.each([
    ['approval', /awaiting approval/u],
    ['confirmation', /confirm your address/u],
  ] as const)('says what a pending %s waits for', async (pending, text) => {
    mockExternal({ register: { body: { pending } } });
    const navigate = vi.fn();
    const onClose = vi.fn();
    await open(onClose, navigate);

    register();

    const shown = await screen.findByRole('status');

    expect(shown).toHaveTextContent(text);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '[ close ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('shows a 422 inline and lets the visitor try again', async () => {
    mockExternal({ register: { status: 422, body: { error: 'Nickname has been taken' } } });
    await open();

    register();

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent('Nickname has been taken');
    expect(screen.getByRole('form', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ register ]' })).toBeEnabled();
  });

  it('refuses a returned address that is not http(s)', async () => {
    mockExternal({ register: { body: { redirect_uri: 'javascript:alert(1)' } } });
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    register();

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent(/not safe to follow/u);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    mockExternal();
    const onClose = vi.fn();
    await open(onClose);

    fireEvent.click(screen.getByRole('button', { name: '[ cancel ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('shows why a bad state cannot be registered, with a way out', async () => {
    mockExternal({ details: { status: 404, body: { error: 'Unknown or expired state' } } });
    const onClose = vi.fn();
    render(<RegisterBox navigate={vi.fn()} onClose={onClose} origin={ORIGIN} state="bad" />);

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent('Unknown or expired state');

    fireEvent.click(screen.getByRole('button', { name: '[ close ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('can be cancelled while loading, and says so when the instance is unreachable', async () => {
    server.use(http.get(`${ORIGIN}/oauth/registration_details`, () => HttpResponse.error()));
    const onClose = vi.fn();
    render(<RegisterBox navigate={vi.fn()} onClose={onClose} origin={ORIGIN} state="st-1" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your details');

    fireEvent.click(screen.getByRole('button', { name: '[ cancel ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent(/Network error/u);
  });
});
