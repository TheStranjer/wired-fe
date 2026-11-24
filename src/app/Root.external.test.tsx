/**
 * Tests for the external-login flows in the running shell (WFE-169): a page
 * loaded at `/oauth/external/register?...` or `/oauth/external/consent?...`
 * (or a hash change to it) opens the matching box with nobody signed in,
 * taking the state out of the address bar; the registration sends the
 * prefilled form and the consent sends Authorize or Deny, each navigating to
 * the returned address; a bad state shows why; Escape closes the box. The real
 * startup runs (it is what turns the path into the hash); the instance is
 * answered over MSW, and the page itself is never really navigated.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigateTo } from './navigate';
import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';
import { mockExternal } from '../test/externalServer';
import { server } from '../test/server';

/** Leaving the page is the one thing these tests only watch. */
vi.mock(import('./navigate'), () => ({ navigateTo: vi.fn() }));

/** Reading an instance is tested beside its module; here it simply fails. */
vi.mock(import('../capabilities/detect'), async (importOriginal) => ({
  ...(await importOriginal()),
  detectInstance: vi
    .fn()
    .mockResolvedValue({ ok: false, error: { kind: 'network', message: 'offline' } }),
}));

/** The origin the page is on; a same-origin build talks to it. */
const PAGE = window.location.origin;

/** Render the shell at {@link url}. */
function open(url: string): void {
  window.history.replaceState(null, '', url);
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
}

describe('the external login flows', () => {
  beforeEach(() => {
    // First in line, so the specific handlers a test adds win over it.
    server.use(http.get(`${PAGE}/api/*`, () => HttpResponse.json([])));
  });

  afterEach(() => {
    vi.mocked(navigateTo).mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('opens the registration from the path and takes the state out of the address bar', async () => {
    const seen = mockExternal({}, PAGE);
    open('/oauth/external/register?state=st-1');

    const dialog = await screen.findByRole('dialog', { name: 'Finish registration' });
    await screen.findByRole('form', { name: 'Register' });

    expect(dialog).toBeInTheDocument();
    expect(seen.query?.get('state')).toBe('st-1');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
  });

  it('registers and goes to the returned address', async () => {
    const seen = mockExternal({}, PAGE);
    open('/oauth/external/register?state=st-1');

    await screen.findByRole('form', { name: 'Register' });
    fireEvent.click(screen.getByRole('button', { name: '[ register ]' }));
    await screen.findByText('Continuing…');

    expect(seen.registered).toMatchObject({ state: 'st-1', nickname: 'lain' });
    expect(navigateTo).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc');
  });

  it('opens the consent from the path and approves', async () => {
    const seen = mockExternal({}, PAGE);
    open('/oauth/external/consent?state=st-1&confirm_token=ct-1');

    await screen.findByRole('dialog', { name: 'Authorize app' });
    fireEvent.click(await screen.findByRole('button', { name: '[ authorize ]' }));
    await screen.findByText('Continuing…');

    expect(seen.decided).toStrictEqual({ state: 'st-1', confirm_token: 'ct-1', approve: true });
    expect(navigateTo).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc');
  });

  it('denies the consent', async () => {
    const seen = mockExternal({}, PAGE);
    open('/oauth/external/consent?state=st-1&confirm_token=ct-1');

    fireEvent.click(await screen.findByRole('button', { name: '[ deny ]' }));
    await screen.findByText('Continuing…');

    expect(seen.decided).toMatchObject({ approve: false });
  });

  it('shows why a bad state cannot be used', async () => {
    mockExternal({ consent: { status: 404, body: { error: 'Unknown or expired state' } } }, PAGE);
    open('/oauth/external/consent?state=bad&confirm_token=x');

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Unknown or expired state');
  });

  it('opens when the hash changes to a route, and Escape closes it', async () => {
    mockExternal({}, PAGE);
    open('/');
    await screen.findByText('Present day. Present time.');
    window.history.replaceState(null, '', '/#/oauth/external/register?state=st-1');
    fireEvent(window, new HashChangeEvent('hashchange'));

    const dialog = await screen.findByRole('dialog', { name: 'Finish registration' });
    await screen.findByRole('form', { name: 'Register' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open for an ordinary page', async () => {
    open('/');
    await screen.findByText('Present day. Present time.');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
