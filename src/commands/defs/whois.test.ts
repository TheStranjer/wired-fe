/**
 * Tests for /whois (aliases /wi and /profile): a handle is looked up through
 * the active window's account (MSW answers the lookup) and the window list is
 * asked for that account's profile window, titled `@<acct>`; a post label and
 * the navigation selection name the post's author instead, a boost its
 * boosted author; a failed lookup or nothing to resolve says so and asks for
 * no window, and so does nobody being signed in. The definition also declares
 * the grammar and the navigation `Shift+w` binding the keymap generates.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './whois';
import { accountKey } from '../../accounts/accountStore';
import { fakeCommandContext } from '../../test/commandContext';
import { TEST_DATE, status } from '../../test/fixtures';
import { homeContext } from '../../test/homeWindow';
import { server } from '../../test/server';

const ORIGIN = 'https://wired.example';
const LAIN_KEY = accountKey(ORIGIN, '1');

/** Somebody else's account, as the lookup answers it. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '<p>not lain</p>',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 3,
  following_count: 4,
  statuses_count: 5,
};

/** What the window list is asked for when nine's profile opens. */
const OPEN_NINE = {
  type: 'open' as const,
  ref: { kind: 'profile' as const, accountKey: LAIN_KEY, target: '9' },
  title: '@nine@pleroma.example',
};

/** A post by nine, so its author differs from the fixture author, lain. */
const BY_NINE = status('n', { account: NINE_WIRE });

/** Answer the lookup with nine, or refuse it with a 404. */
function serveLookup(found: boolean): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/lookup`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('acct')).toBe('nine@pleroma.example');

      return found
        ? HttpResponse.json(NINE_WIRE)
        : HttpResponse.json({ error: 'Record not found' }, { status: 404 });
    }),
  );
}

describe('/whois', () => {
  it('opens the window of the handle the instance looks up', async () => {
    serveLookup(true);
    const context = homeContext([]);

    await expect(command.run('@nine@pleroma.example', context)).resolves.toStrictEqual({
      ok: true,
    });

    expect(context.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('opens the author of the post a label names, and of the selection', async () => {
    const byLabel = homeContext([BY_NINE]);
    const selected = homeContext([BY_NINE], 'n');

    await expect(command.run('a0', byLabel)).resolves.toStrictEqual({ ok: true });
    await expect(command.run('', selected)).resolves.toStrictEqual({ ok: true });

    expect(byLabel.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
    expect(selected.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('opens the boosted author of a boost, not the booster', async () => {
    const boost = status('boost', { reblog: BY_NINE });
    const context = homeContext([boost]);

    await expect(command.run('a0', context)).resolves.toStrictEqual({ ok: true });

    expect(context.dispatchWindows).toHaveBeenCalledWith(OPEN_NINE);
  });

  it('reports a lookup the instance refused and asks for no window', async () => {
    serveLookup(false);
    const context = homeContext([]);

    await expect(command.run('@nine@pleroma.example', context)).resolves.toStrictEqual({
      ok: false,
      message: 'No account @nine@pleroma.example: HTTP 404: Record not found',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses with nothing to resolve and asks for no window', async () => {
    const context = homeContext([BY_NINE]);

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses while nobody is signed in, before asking the network', async () => {
    // No handler is registered: any request would fail the test.
    const context = fakeCommandContext();

    await expect(command.run('@nine@pleroma.example', context)).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });

    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('is also /wi and /profile, bound to navigation Shift+w', () => {
    expect(command.name).toBe('whois');
    expect(command.aliases).toStrictEqual(['wi', 'profile']);
    expect(command.usage).toBe('/whois [label | @user@host]');
    expect(command.summary).toBe("Open an account's profile window");
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'Shift+w', args: '' }]);
  });
});
