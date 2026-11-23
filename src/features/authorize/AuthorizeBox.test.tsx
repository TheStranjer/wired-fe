/**
 * Tests for the authorization box over the shared MSW server: it shows the
 * app's name, its website as plain text (http(s) only) and every permission
 * in words; Authorize posts the approval under the bearer token and navigates
 * to the returned address, Deny posts a denial the same way; an out-of-band
 * answer shows its code with a copy button; a returned address that is not
 * http(s) is refused; and a 400, a 403 for an untrusted app or a network
 * failure print their message and offer to close.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthorizeBox } from './AuthorizeBox';
import { INFO, ORIGIN, QUERY, mockAuthorize } from '../../test/authorizeServer';
import { server } from '../../test/server';

const SESSION = { origin: ORIGIN, token: 'user-token' };

/** Render the box for the test request and wait for the question. */
async function open(onClose = vi.fn(), navigate = vi.fn()): Promise<void> {
  render(
    <AuthorizeBox
      handle="lain@wired.example"
      navigate={navigate}
      onClose={onClose}
      query={QUERY}
      session={SESSION}
    />,
  );
  await screen.findByRole('button', { name: '[ authorize ]' });
}

/** Click the button named {@link name}. */
function choose(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('the authorization box', () => {
  /** jsdom has no clipboard; every stubbed one is taken back after the test. */
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  afterEach(() => {
    if (originalClipboard === undefined) {
      Reflect.deleteProperty(navigator, 'clipboard');
    } else {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    }
  });

  it('shows the app, its website and every permission in words', async () => {
    mockAuthorize();

    await open();

    expect(screen.getByRole('heading', { name: 'Authorize Cool App?' })).toBeInTheDocument();
    expect(screen.getByText('Website: https://cool.example/')).toBeInTheDocument();
    expect(screen.getByText(/As @lain@wired.example/u)).toBeInTheDocument();
    expect(screen.getByText('Read everything you can see (read)')).toBeInTheDocument();
    expect(screen.getByText('Change your statuses (write:statuses)')).toBeInTheDocument();
  });

  it('leaves out a website that is not http(s)', async () => {
    mockAuthorize({
      info: { body: { ...INFO, app: { name: 'Odd', website: 'javascript:alert(1)' } } },
    });

    await open();

    expect(screen.queryByText(/Website:/u)).not.toBeInTheDocument();
  });

  it('approves under the bearer token and goes to the returned address', async () => {
    const seen = mockAuthorize();
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ authorize ]');

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent('Returning to the app');
    expect(seen.auth).toBe('Bearer user-token');
    expect(seen.body).toStrictEqual({
      client_id: 'client-1',
      redirect_uri: 'https://cool.example/cb',
      scope: 'read write:statuses',
      state: 'xyz',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      approve: true,
    });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=abc&state=xyz');
  });

  it('denies and goes to the error address', async () => {
    const seen = mockAuthorize({
      decision: { body: { redirect_uri: 'https://cool.example/cb?error=access_denied&state=xyz' } },
    });
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ deny ]');

    await screen.findByRole('status');

    expect(seen.body).toMatchObject({ approve: false });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      'https://cool.example/cb?error=access_denied&state=xyz',
    );
  });

  it('shows an out-of-band code and copies it', async () => {
    mockAuthorize({ decision: { body: { code: 'oob-code-1' } } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const navigate = vi.fn();
    await open(vi.fn(), navigate);

    choose('[ authorize ]');
    await screen.findByText('oob-code-1');
    choose('[ copy ]');

    const note = await screen.findByText('Copied to the clipboard.');

    expect(note).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('oob-code-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says so when the code cannot be copied', async () => {
    mockAuthorize({ decision: { body: { code: 'oob-code-2' } } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await open();

    choose('[ authorize ]');
    await screen.findByText('oob-code-2');
    choose('[ copy ]');

    const note = await screen.findByText(/Could not copy/u);

    expect(note).toBeInTheDocument();
  });

  it('closes after a denial of an out-of-band app, which has nowhere to go', async () => {
    mockAuthorize({ decision: { body: { redirect_uri: 'urn:ietf:wg:oauth:2.0:oob' } } });
    const onClose = vi.fn();
    const navigate = vi.fn();
    await open(onClose, navigate);

    choose('[ deny ]');
    await screen.findByRole('status');
    choose('[ close ]');

    expect(navigate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'myapp://cb'])(
    'refuses the returned address %j',
    async (uri) => {
      mockAuthorize({ decision: { body: { redirect_uri: uri } } });
      const navigate = vi.fn();
      await open(vi.fn(), navigate);

      choose('[ authorize ]');

      const failure = await screen.findByRole('alert');

      expect(failure).toHaveTextContent(/not safe to follow/u);
      expect(navigate).not.toHaveBeenCalled();
    },
  );

  it('explains that the instance has not trusted WiredFE on a 403', async () => {
    mockAuthorize({ decision: { status: 403, body: { error: 'unauthorized_client' } } });
    const onClose = vi.fn();
    await open(onClose);

    choose('[ authorize ]');

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent(/not marked WiredFE as a trusted app/u);

    choose('[ close ]');

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('prints a refused request and offers to close', async () => {
    mockAuthorize({ info: { status: 400, body: { error: 'invalid_request' } } });
    const onClose = vi.fn();
    render(
      <AuthorizeBox
        handle="lain@wired.example"
        navigate={vi.fn()}
        onClose={onClose}
        query={QUERY}
        session={SESSION}
      />,
    );

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent(
      'The instance refused this authorization request: invalid_request',
    );

    choose('[ close ]');

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });

  it('prints a network failure', async () => {
    server.use(http.get(`${ORIGIN}/oauth/authorize`, () => HttpResponse.error()));
    render(
      <AuthorizeBox
        handle="lain@wired.example"
        navigate={vi.fn()}
        onClose={vi.fn()}
        query={QUERY}
        session={SESSION}
      />,
    );

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent(/Network error/u);
  });

  it('can be cancelled while the request loads', () => {
    mockAuthorize();
    const onClose = vi.fn();
    render(
      <AuthorizeBox
        handle="lain@wired.example"
        navigate={vi.fn()}
        onClose={onClose}
        query={QUERY}
        session={SESSION}
      />,
    );

    choose('[ cancel ]');

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });
});
