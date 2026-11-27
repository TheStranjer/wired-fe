/**
 * Tests for the hash router with nobody to open a route (decision 4, WFE-340):
 * a visitor with no account reads a public link read-only, under the
 * signed-out key of the instance, and the hash leaves the address bar; where
 * the build or the instance says no (public view off, an instance restricting
 * the read, an `open` build, an unlisted host) the hint is printed and the
 * hash kept. Each instance's published policy is seeded as its profile, so no
 * test reaches for the network.
 */
import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import type { PublicConfig } from './publicRoute';
import { useHashRoute } from './useHashRoute';
import type { AnonymousReads } from '../capabilities/publicView';
import { capabilitiesOn } from '../capabilities/testCapabilities';
import { anonKey } from '../state/anonAccount';
import type { AppAction } from '../state/reducer';
import { ORIGIN, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';

/** What an instance showing every local read to visitors publishes. */
const OPEN_READS: AnonymousReads = {
  posts: { local: true, remote: false },
  profiles: { local: true, remote: false },
  tags: { local: true, remote: false },
};

/** What an instance restricting every read to its own users publishes. */
const RESTRICTED_READS: AnonymousReads = {
  posts: { local: false, remote: false },
  profiles: { local: false, remote: false },
  tags: { local: false, remote: false },
};

/** The profile of {@link origin} publishing {@link reads}, as the app state holds it after detection. */
function profileOf(origin: string, reads: AnonymousReads): AppAction {
  return {
    type: 'profile',
    profile: {
      origin,
      title: 'Wired',
      capabilities: { ...capabilitiesOn('wired', []), anonymousReads: reads },
    },
  };
}

/** A hook mounting the router with {@link config}. */
function routerWith(config: PublicConfig): (ready: boolean) => void {
  return function useRouter(ready: boolean): void {
    useHashRoute(ready, config);
  };
}

/** The router of {@link config} mounted with nobody signed in and {@link seen} detected. */
function mount(config: PublicConfig, seen: readonly AppAction[]): ReturnType<typeof mountRouter> {
  return mountRouter(routerWith(config), true, seen);
}

const HERE = window.location.origin;
const SAME: PublicConfig = { instances: { mode: 'same-origin' } };
const LIST: PublicConfig = { instances: { mode: 'list', origins: [ORIGIN] } };
const HINT = 'Not connected. Type /connect to log in.';

describe('the hash router with nobody signed in', () => {
  afterEach(() => {
    visit('/');
  });

  it('opens a public post read-only and takes the hash out of the address bar', async () => {
    visit('/#/notice/5');

    const { result } = mount(SAME, [profileOf(HERE, OPEN_READS)]);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', 'thread/5']);
    });

    expect(result.current.state.windows.activeId).toBe(`thread:${anonKey(HERE)}:5`);
    expect(statusLines(result.current.state)).toStrictEqual([]);
    expect(window.location.hash).toBe('');
  });

  it('opens a public tag the same way', async () => {
    visit('/#/tag/Rust');

    const { result } = mount(SAME, [profileOf(HERE, OPEN_READS)]);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '#rust']);
    });

    expect(result.current.state.windows.activeId).toBe(`hashtag:${anonKey(HERE)}:rust`);
  });

  it('opens a qualified link of a listed instance under that instance', async () => {
    visit('/#/wired.example/notice/5');

    const { result } = mount(LIST, [profileOf(ORIGIN, OPEN_READS)]);

    await waitFor(() => {
      expect(result.current.state.windows.activeId).toBe(`thread:${anonKey(ORIGIN)}:5`);
    });

    expect(window.location.hash).toBe('');
  });

  it('prints the hint and keeps the hash where the instance restricts the read', async () => {
    visit('/#/notice/5');

    const { result } = mount(SAME, [profileOf(HERE, RESTRICTED_READS)]);

    await waitFor(() => {
      expect(statusLines(result.current.state)).toStrictEqual([HINT]);
    });

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(window.location.hash).toBe('#/notice/5');
  });

  it('prints the hint at once and keeps the hash where the build turns public view off', () => {
    visit('/#/notice/5');

    const { result } = mount({ ...SAME, publicView: false }, [profileOf(HERE, OPEN_READS)]);

    expect(statusLines(result.current.state)).toStrictEqual([HINT]);
    expect(window.location.hash).toBe('#/notice/5');
  });

  it('prints the hint for an instance the list does not name', () => {
    visit('/#/other.example/notice/5');

    const { result } = mount(LIST, [profileOf(ORIGIN, OPEN_READS)]);

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not signed in to other.example. Type /connect to log in there.',
    ]);
    expect(window.location.hash).toBe('#/other.example/notice/5');
  });

  it('prints the hint in an open build, which never shows a stranger to visitors', () => {
    visit('/#/other.example/notice/5');

    const { result } = mount({ instances: { mode: 'open' } }, []);

    expect(statusLines(result.current.state)).toHaveLength(1);
    expect(window.location.hash).toBe('#/other.example/notice/5');
  });

  it('detects the instance itself, with no token, when nothing is known of it yet', async () => {
    const seen: (string | null)[] = [];
    const answer = (body: object, status = 200) => {
      return ({ request }: { readonly request: Request }) => {
        seen.push(request.headers.get('Authorization'));
        return HttpResponse.json(body, { status });
      };
    };
    server.use(
      http.get(
        `${HERE}/.well-known/nodeinfo`,
        answer({
          links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: `${HERE}/ni` }],
        }),
      ),
      http.get(`${HERE}/ni`, answer({ version: '2.1', software: { name: 'wired' } })),
      http.get(`${HERE}/api/v1/instance`, answer({ title: 'The Wired', version: '2.7.2' })),
      http.get(`${HERE}/api/v2/instance`, answer({ error: 'Record not found' }, 404)),
    );
    visit('/#/notice/5');

    const { result } = mount(SAME, []);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', 'thread/5']);
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((header) => header === null)).toBe(true);
    expect(window.location.hash).toBe('');
  });
});
