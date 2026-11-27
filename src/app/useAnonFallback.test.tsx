/**
 * Tests for the fallback of a refused signed-out read (WFE-340, decision 4): a
 * 401 or 403 on a window of an `anon:<origin>` key closes that key's windows,
 * prints the `/connect` hint in the status window and puts the link back in the
 * address bar (written the way the build writes permalinks); where the build
 * forced `publicView` on and the backend published a refusal it also warns,
 * once, and otherwise it does not. The refusal is answered and cleared.
 */
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PublicConfig } from './publicRoute';
import { useAnonFallback } from './useAnonFallback';
import type { AnonymousReads } from '../capabilities/publicView';
import { capabilitiesOn } from '../capabilities/testCapabilities';
import { anonKey } from '../state/anonAccount';
import type { AppAction } from '../state/reducer';
import { LAIN, ORIGIN, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import type { WindowRef } from '../windows/model';

const KEY = anonKey(ORIGIN);
const SAME: PublicConfig = { instances: { mode: 'same-origin' } };

/** What an instance restricting every read publishes. */
const RESTRICTED: AnonymousReads = {
  posts: { local: false, remote: false },
  profiles: { local: false, remote: false },
  tags: { local: false, remote: false },
};

/** The actions that leave a signed-out window of {@link ref} refused. */
function refused(ref: WindowRef, extra: readonly AppAction[] = []): readonly AppAction[] {
  return [
    ...extra,
    { type: 'windows', action: { type: 'open', ref, title: 'window' } },
    { type: 'anonRefused', accountKey: ref.accountKey ?? KEY },
  ];
}

/** A hook mounting the fallback with {@link config}. */
function fallbackWith(config: PublicConfig): () => void {
  return function useFallback(): void {
    useAnonFallback(config);
  };
}

/** The fallback mounted over the state {@link actions} lead to. */
function mount(
  config: PublicConfig,
  actions: readonly AppAction[],
): ReturnType<typeof mountRouter> {
  return mountRouter(fallbackWith(config), true, actions);
}

/** A profile of the instance publishing {@link reads}. */
function publishing(reads: AnonymousReads): AppAction {
  return {
    type: 'profile',
    profile: {
      origin: ORIGIN,
      title: 'Wired',
      capabilities: { ...capabilitiesOn('wired', []), anonymousReads: reads },
    },
  };
}

describe(useAnonFallback, () => {
  afterEach(() => {
    visit('/');
  });

  it('closes the window, prints the hint and puts the link back', async () => {
    const { result } = mount(SAME, refused({ kind: 'thread', accountKey: KEY, target: '5' }));

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status']);
    });

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not connected. Type /connect to log in.',
    ]);
    expect(window.location.hash).toBe('#/notice/5');
    expect(result.current.state.anonRefused.size).toBe(0);
  });

  it('puts a tag and a profile back as their routes', async () => {
    const tag = mount(SAME, refused({ kind: 'hashtag', accountKey: KEY, target: 'rust' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/tag/rust');
    });
    tag.unmount();

    const profile = mount(SAME, refused({ kind: 'profile', accountKey: KEY, target: '55' }));

    await waitFor(() => {
      expect(titles(profile.result.current.state)).toStrictEqual(['status']);
    });

    expect(window.location.hash).toBe('#/users/55');
  });

  it('writes the link qualified in a list build, and names the host in the hint', async () => {
    const list: PublicConfig = { instances: { mode: 'list', origins: [ORIGIN] } };
    const { result } = mount(list, refused({ kind: 'thread', accountKey: KEY, target: '5' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/wired.example/notice/5');
    });

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not signed in to wired.example. Type /connect to log in there.',
    ]);
  });

  it('warns once when publicView is forced on and the backend restricts the read', async () => {
    const forced: PublicConfig = { instances: { mode: 'same-origin' }, publicView: true };
    const { result } = mount(
      forced,
      refused({ kind: 'thread', accountKey: KEY, target: '5' }, [publishing(RESTRICTED)]),
    );

    await waitFor(() => {
      expect(statusLines(result.current.state)).toHaveLength(2);
    });

    expect(statusLines(result.current.state).at(-1)).toBe(
      'publicView is forced on for wired.example, but the instance restricts this read for signed-out visitors.',
    );
  });

  it('does not warn when the backend was left to decide', async () => {
    const { result } = mount(
      SAME,
      refused({ kind: 'thread', accountKey: KEY, target: '5' }, [publishing(RESTRICTED)]),
    );

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status']);
    });

    expect(statusLines(result.current.state)).toHaveLength(1);
  });

  it('only prints the hint for a window no route opens, and leaves the address bar alone', async () => {
    const { result } = mount(SAME, refused({ kind: 'search', accountKey: KEY, target: 'q' }));

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status']);
    });

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not connected. Type /connect to log in.',
    ]);
    expect(window.location.hash).toBe('');
  });

  it('clears a refusal that is no signed-out key without touching any window', async () => {
    const own: WindowRef = { kind: 'thread', accountKey: LAIN.key, target: '5' };
    const { result } = mount(SAME, [
      { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key },
      { type: 'windows', action: { type: 'open', ref: own, title: 'thread/5' } },
      { type: 'anonRefused', accountKey: LAIN.key },
    ]);

    await waitFor(() => {
      expect(result.current.state.anonRefused.size).toBe(0);
    });

    expect(titles(result.current.state)).toStrictEqual(['status', 'thread/5']);
  });
});
