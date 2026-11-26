/**
 * Tests for the reset-letter overlay in the running shell (WFE-163): a page
 * loaded at `/password_reset/<token>` (or a hash change to it) opens the box
 * with nobody signed in, its fields are new-password inputs, Escape closes
 * it, a mismatch is caught before any request, a send carries the token and
 * the new password and says so on success, the instance's error string is
 * shown on a refusal, and the password never reaches the command line. The
 * real startup runs (it is what turns the path into the hash); the instance
 * is answered over MSW.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';

/** The origin the page is on; a same-origin build resets here. */
const PAGE = window.location.origin;

/** The bodies the reset endpoint has been sent. */
type Seen = unknown[];

/** Answers the reset endpoint with {@link respond}, recording every body into the returned list. */
function mockReset(respond: () => Response): Seen {
  const seen: Seen = [];
  server.use(
    http.post(`${PAGE}/api/v1/pleroma/password_reset`, async ({ request }) => {
      seen.push(await request.json());
      return respond();
    }),
  );
  return seen;
}

/** Render the shell at {@link url}, nobody signed in. */
function open(url: string): void {
  window.history.replaceState(null, '', url);
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
}

/** Type {@link password} and {@link confirmation} into the box and send. */
function fillAndSend(password: string, confirmation: string): void {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: '[ reset password ]' }));
}

describe('the reset-letter overlay', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('opens from the path with two new-password fields and takes the route out of the address bar', async () => {
    open('/password_reset/tok-1');

    const dialog = await screen.findByRole('dialog', { name: 'Reset password' });

    expect(dialog).toBeInTheDocument();

    for (const name of ['New password', 'Confirm new password']) {
      const field = screen.getByLabelText(name);

      expect(field).toHaveAttribute('type', 'password');
      expect(field).toHaveAttribute('autocomplete', 'new-password');
    }

    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('opens when the hash changes to a reset route, and Escape closes it', async () => {
    open('/');
    window.history.replaceState(null, '', '/#/password_reset/tok-2');
    fireEvent(window, new HashChangeEvent('hashchange'));

    const dialog = await screen.findByRole('dialog', { name: 'Reset password' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open for an ordinary page', async () => {
    open('/');
    await screen.findByText('Present day. Present time.');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('catches a mismatch before sending anything', async () => {
    const seen = mockReset(() => new HttpResponse(null, { status: 204 }));
    open('/password_reset/tok-1');
    await screen.findByRole('dialog', { name: 'Reset password' });

    fillAndSend('hunter2hunter2', 'hunter3hunter3');

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('The two passwords do not match.');
    expect(seen).toHaveLength(0);
  });

  it('sends the token and the new password and says it is changed', async () => {
    const seen = mockReset(() => new HttpResponse(null, { status: 204 }));
    open('/password_reset/tok-1');
    await screen.findByRole('dialog', { name: 'Reset password' });

    fillAndSend('hunter2hunter2', 'hunter2hunter2');

    const notice = await screen.findByRole('status');

    expect(notice).toHaveTextContent('Password changed');
    expect(seen).toStrictEqual([
      { token: 'tok-1', password: 'hunter2hunter2', password_confirmation: 'hunter2hunter2' },
    ]);
    expect(screen.getByRole('combobox', { name: 'Command line' })).toHaveValue('');
    expect(screen.queryByDisplayValue('hunter2hunter2')).not.toBeInTheDocument();
  });

  it('shows the server’s error string', async () => {
    mockReset(() => HttpResponse.json({ error: 'Invalid token' }, { status: 400 }));
    open('/password_reset/stale');
    await screen.findByRole('dialog', { name: 'Reset password' });

    fillAndSend('hunter2hunter2', 'hunter2hunter2');

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Invalid token');
  });

  it('closes from the success notice', async () => {
    mockReset(() => new HttpResponse(null, { status: 204 }));
    open('/password_reset/tok-1');
    await screen.findByRole('dialog', { name: 'Reset password' });
    fillAndSend('hunter2hunter2', 'hunter2hunter2');
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: '[ close ]' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
