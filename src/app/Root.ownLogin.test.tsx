/**
 * Tests for WiredFE's own login through the authorization overlay (WFE-177):
 * `/connect` on a same-origin build sends the browser to
 * `/oauth/authorize` with WiredFE's own cached app; after the password login
 * there is no authorization box, the account is active and the address bar is
 * back at the root. Another app's request still gets its box.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigateTo } from './navigate';
import { Root } from './Root';
import { appStores } from './stores';
import { readPendingLogin, savePendingLogin } from '../accounts/pendingLogin';
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

/** WiredFE's own redirect URI, as `/connect` registered it. */
const OWN_REDIRECT = `${PAGE}/`;

/** The request `/connect` makes: WiredFE's own app and the pending login's state. */
const OWN_REQUEST = `client_id=own-app&redirect_uri=${encodeURIComponent(OWN_REDIRECT)}&response_type=code&scope=read&state=pending-1`;

/** Another app's request. */
const OTHER_REQUEST =
  'client_id=client-1&redirect_uri=https%3A%2F%2Fcool.example%2Fcb&response_type=code&scope=read&state=xyz';

/** Render the shell at {@link url}. */
function open(url: string): void {
  window.history.replaceState(null, '', url);
  render(
    <AppStateProvider>
      <Root />
    </AppStateProvider>,
  );
}

/** What `/connect` leaves behind: the cached own app and the pending login. */
function beginConnect(): void {
  const { apps, login } = appStores();
  apps.set(`${PAGE} ${OWN_REDIRECT}`, { client_id: 'own-app', client_secret: 'own-secret' });
  savePendingLogin(login, {
    origin: PAGE,
    state: 'pending-1',
    redirectUri: OWN_REDIRECT,
    createdAt: new Date().getTime(),
  });
}

/** Fill in and submit the password login. */
function logIn(): void {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'lain' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2hunter2' } });
  fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));
}

/** Open WiredFE's own request signed out, log in, and wait for the overlay to end; what the instance saw of `/oauth/authorize`. */
async function ownLogin(): Promise<ReturnType<typeof mockAuthorize>> {
  mockRegistration({ appToken: { body: { access_token: 'user-token' } } }, PAGE);
  const seen = mockAuthorize({}, PAGE);
  open(`/oauth/authorize?${OWN_REQUEST}`);
  await screen.findByRole('form', { name: 'Log in' });
  logIn();
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  return seen;
}

describe('WiredFE’s own login through the authorization overlay', () => {
  beforeEach(() => {
    server.use(http.get(`${PAGE}/api/*`, () => HttpResponse.json([])));
    beginConnect();
  });

  afterEach(() => {
    const { accounts, apps, login } = appStores();
    for (const account of accounts.list()) {
      accounts.remove(account.key);
    }
    apps.remove(`${PAGE} ${OWN_REDIRECT}`);
    login.remove('pending');
    vi.mocked(navigateTo).mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('logs in and ends there: no authorization box, the account active', async () => {
    const seen = await ownLogin();

    expect(appStores().accounts.activeKey()).not.toBeNull();
    expect(screen.queryByRole('button', { name: '[ authorize ]' })).not.toBeInTheDocument();
    expect(seen.query).toBeNull();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('leaves the address at the root and the pending login spent', async () => {
    await ownLogin();

    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('');
    expect(readPendingLogin(appStores().login, new Date().getTime())).toBeNull();
  });

  it('shows no box when already signed in either', async () => {
    appStores().accounts.add({
      origin: PAGE,
      accountId: '1',
      handle: 'lain@localhost',
      token: 'seeded-token',
      refreshToken: null,
      expiresAt: null,
    });
    const seen = mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${OWN_REQUEST}`);
    await screen.findByText('Present day. Present time.');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(seen.query).toBeNull();
  });

  it('still asks about another app’s request', async () => {
    mockRegistration({ appToken: { body: { access_token: 'user-token' } } }, PAGE);
    mockAuthorize({}, PAGE);
    open(`/oauth/authorize?${OTHER_REQUEST}`);
    await screen.findByRole('form', { name: 'Log in' });

    logIn();

    const authorize = await screen.findByRole('button', { name: '[ authorize ]' });

    expect(authorize).toBeInTheDocument();
  });
});
