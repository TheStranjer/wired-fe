/**
 * Tests for the third-party app authorization in the running shell (WFE-168):
 * a page loaded at `/oauth/authorize?...` (or a hash change to it) opens the
 * box with the app's details, taking the request out of the address bar; with
 * nobody signed in to the instance the password login comes first and the
 * request resumes after it; Authorize and Deny post under the account's bearer
 * token and send the browser on; Escape closes the box. The real startup runs
 * (it is what turns the path into the hash); the instance is answered over MSW,
 * and the page itself is never really navigated.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigateTo } from './navigate';
import { Root } from './Root';
import { appStores } from './stores';
import { AppStateProvider } from '../state/StateContext';
import { mockAuthorize } from '../test/authorizeServer';
import { mockRegistration } from '../test/registrationServer';
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

/** The origin the page is on; a same-origin build authorizes here. */
const PAGE = window.location.origin;

/** What an app's redirect from wired-be carries. */
const REQUEST =
  'client_id=client-1&redirect_uri=https%3A%2F%2Fcool.example%2Fcb&response_type=code&scope=read&state=xyz';

/** Render the shell at {@link url}, with the instance's other endpoints answering an empty list. */
function open(url: string): void {
  window.history.replaceState(null, '', url);
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
}

/** Sign lain in to the page's own instance, as an earlier session did. */
function signIn(): void {
  appStores().accounts.add({
    origin: PAGE,
    accountId: '1',
    handle: 'lain@localhost',
    token: 'seeded-token',
    refreshToken: null,
    expiresAt: null,
  });
}

describe('the app authorization', () => {
  beforeEach(() => {
    // First in line, so the specific handlers a test adds win over it.
    server.use(http.get(`${PAGE}/api/*`, () => HttpResponse.json([])));
  });

  afterEach(() => {
    const { accounts } = appStores();
    for (const account of accounts.list()) {
      accounts.remove(account.key);
    }
    vi.mocked(navigateTo).mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('opens from the path with the app’s details and takes the request out of the address bar', async () => {
    signIn();
    const seen = mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${REQUEST}`);

    const dialog = await screen.findByRole('dialog', { name: 'Authorize app' });
    await screen.findByRole('heading', { name: 'Authorize Cool App?' });

    expect(dialog).toBeInTheDocument();
    expect(seen.query?.get('client_id')).toBe('client-1');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
  });

  it('approves under the account’s token and goes to the returned address', async () => {
    signIn();
    const seen = mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${REQUEST}`);

    fireEvent.click(await screen.findByRole('button', { name: '[ authorize ]' }));
    await screen.findByText('Returning to the app…');

    expect(seen.auth).toBe('Bearer seeded-token');
    expect(seen.body).toMatchObject({ client_id: 'client-1', scope: 'read', approve: true });
    expect(navigateTo).toHaveBeenCalledExactlyOnceWith(
      'https://cool.example/cb?code=abc&state=xyz',
    );
  });

  it('denies and goes to the error address', async () => {
    signIn();
    mockAuthorize(
      { decision: { body: { redirect_uri: 'https://cool.example/cb?error=access_denied' } } },
      PAGE,
    );
    open(`/oauth/authorize?${REQUEST}`);

    fireEvent.click(await screen.findByRole('button', { name: '[ deny ]' }));
    await screen.findByText('Returning to the app…');

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith(
      'https://cool.example/cb?error=access_denied',
    );
  });

  it('logs in first when nobody is signed in, then resumes the request', async () => {
    mockRegistration({ appToken: { body: { access_token: 'user-token' } } }, PAGE);
    const seen = mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${REQUEST}`);
    await screen.findByRole('form', { name: 'Log in' });

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'lain' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));
    fireEvent.click(await screen.findByRole('button', { name: '[ authorize ]' }));
    await screen.findByText('Returning to the app…');

    expect(seen.auth).toBe('Bearer user-token');
    expect(screen.getByRole('combobox', { name: 'Command line' })).toHaveValue('');
    expect(navigateTo).toHaveBeenCalledExactlyOnceWith(
      'https://cool.example/cb?code=abc&state=xyz',
    );
  });

  it('shows refused credentials and stays at the login', async () => {
    mockRegistration({ appToken: { status: 400, body: { error: 'Invalid credentials' } } }, PAGE);
    mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${REQUEST}`);
    await screen.findByRole('form', { name: 'Log in' });

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Invalid credentials');
    expect(screen.queryByRole('button', { name: '[ authorize ]' })).not.toBeInTheDocument();
  });

  it('opens when the hash changes to a request, and Escape closes it', async () => {
    signIn();
    mockAuthorize({}, PAGE);
    open('/');
    await screen.findByText('Present day. Present time.');
    window.history.replaceState(null, '', `/#/oauth/authorize?${REQUEST}`);
    fireEvent(window, new HashChangeEvent('hashchange'));

    const dialog = await screen.findByRole('dialog', { name: 'Authorize app' });
    await screen.findByRole('button', { name: '[ authorize ]' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open for an ordinary page', async () => {
    open('/');
    await screen.findByText('Present day. Present time.');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
