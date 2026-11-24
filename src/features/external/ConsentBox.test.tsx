/**
 * Tests for the external-login consent box over the shared MSW server: it
 * shows the app's name, its website as plain text (http(s) only) and its
 * scopes; Authorize and Deny post the answer with the state and confirm token
 * and navigate to the returned address; an unsafe address is refused; and a
 * bad state or a failed answer shows why with a way out.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsentBox } from './ConsentBox';
import { CONSENT, ORIGIN, mockExternal } from '../../test/externalServer';

/** Render the box for the test login and wait for the question. */
async function open(onClose = vi.fn(), navigate = vi.fn()): Promise<void> {
  render(
    <ConsentBox
      confirmToken="ct-1"
      navigate={navigate}
      onClose={onClose}
      origin={ORIGIN}
      state="st-1"
    />,
  );
  await screen.findByRole('button', { name: '[ authorize ]' });
}

/** Click the button named {@link name}. */
function choose(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('the external consent box', () => {
  it('shows the app, its website and its scopes', async () => {
    const seen = mockExternal();

    await open();

    expect(screen.getByRole('heading', { name: 'Authorize Cool App?' })).toBeInTheDocument();
    expect(screen.getByText('Website: https://cool.example/')).toBeInTheDocument();
    expect(screen.getByText('write:statuses')).toBeInTheDocument();
    expect(seen.query?.get('confirm_token')).toBe('ct-1');
    expect(screen.getByRole('button', { name: '[ authorize ]' })).toHaveFocus();
  });

  it('leaves out a website that is not http(s) or absent', async () => {
    mockExternal({
      consent: { body: { app: { name: 'Odd', website: 'javascript:alert(1)' }, scopes: [] } },
    });

    await open();

    expect(screen.queryByText(/Website:/u)).not.toBeInTheDocument();
  });

  it('leaves out a missing website', async () => {
    mockExternal({ consent: { body: { app: { name: 'Bare' }, scopes: [] } } });

    await open();

    expect(screen.queryByText(/Website:/u)).not.toBeInTheDocument();
  });

  it('approves and goes to the returned address', async () => {
    const seen = mockExternal();
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ authorize ]');

    const shown = await screen.findByRole('status');

    expect(shown).toHaveTextContent('Continuing');
    expect(seen.decided).toStrictEqual({ state: 'st-1', confirm_token: 'ct-1', approve: true });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc');
  });

  it('denies and goes to the returned address', async () => {
    const seen = mockExternal({
      decision: { body: { redirect_uri: 'https://cool.example/cb?error=access_denied' } },
    });
    const navigate = vi.fn();
    const onClose = vi.fn();
    await open(onClose, navigate);

    choose('[ deny ]');
    await screen.findByRole('status');
    choose('[ close ]');

    expect(seen.decided).toMatchObject({ approve: false });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?error=access_denied');
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('refuses a returned address that is not http(s)', async () => {
    mockExternal({ decision: { body: { redirect_uri: 'data:text/html,hi' } } });
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ authorize ]');

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent(/not safe to follow/u);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a refused answer and offers to close', async () => {
    mockExternal({ decision: { status: 422, body: { error: 'Confirmation expired' } } });
    await open();

    choose('[ deny ]');

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent('Confirmation expired');
    expect(screen.getByRole('button', { name: '[ close ]' })).toBeInTheDocument();
  });

  it('shows why a bad state cannot be answered, with a way out', async () => {
    mockExternal({ consent: { status: 404, body: { error: 'Unknown or expired state' } } });
    const onClose = vi.fn();
    render(
      <ConsentBox
        confirmToken="x"
        navigate={vi.fn()}
        onClose={onClose}
        origin={ORIGIN}
        state="bad"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading the request');

    const shown = await screen.findByRole('alert');

    expect(shown).toHaveTextContent('Unknown or expired state');

    choose('[ close ]');

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('answers once while a decision is in flight', async () => {
    mockExternal({ consent: { body: CONSENT } });
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ authorize ]');
    choose('[ authorize ]');
    await screen.findByRole('status');

    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc');
  });
});
