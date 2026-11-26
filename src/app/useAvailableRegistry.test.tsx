/**
 * Tests for the registry as the active account sees it (WFE-172), over the
 * shipped commands: with nobody signed in everything is there; on a Mastodon
 * `/react`, `/unreact` and `/forgot` are gone from the list and the keymap
 * (`Shift+e` binds nothing) and `/vis` has no `local`; on a Wired they are
 * back; and switching the active account switches the answer.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAvailableRegistry } from './useAvailableRegistry';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../capabilities/testCapabilities';
import { buildKeymap } from '../keys/keymap';
import { useAppDispatch } from '../state/StateContext';
import { seeded } from '../test/appSessions';
import { accountOn, signedInOn } from '../test/backendSessions';

const ALICE = accountOn('https://mastodon.test', 'alice@mastodon.test');
const WANDA = accountOn('https://wired.test', 'wanda@wired.test');

/** Both accounts signed in and detected, alice active. */
const BOTH = [
  ...signedInOn(ALICE, MASTODON_CAPABILITIES),
  ...signedInOn(WANDA, WIRED_CAPABILITIES).slice(1),
  { type: 'accounts', accounts: [ALICE, WANDA], activeKey: ALICE.key },
] as const;

/** The hook plus the dispatch to switch accounts with. */
function renderRegistry(actions: Parameters<typeof seeded>[0]) {
  return renderHook(() => ({ registry: useAvailableRegistry(), dispatch: useAppDispatch() }), {
    wrapper: seeded(actions),
  });
}

describe(useAvailableRegistry, () => {
  it('offers every command while nobody is signed in', () => {
    const { registry } = renderRegistry([]).result.current;

    for (const name of ['react', 'unreact', 'forgot', 'quote', 'edit']) {
      expect(registry.byName.has(name)).toBe(true);
    }
  });

  it('hides what a Mastodon cannot do from the list', () => {
    const { registry } = renderRegistry(BOTH).result.current;

    for (const name of ['react', 'unreact', 'forgot']) {
      expect(registry.byName.has(name)).toBe(false);
      expect(registry.hidden?.has(name)).toBe(true);
    }

    expect(registry.byName.has('quote')).toBe(true);
  });

  it('binds no Shift+e on a Mastodon, but still q', () => {
    const keymap = buildKeymap(renderRegistry(BOTH).result.current.registry);

    expect(keymap.navigation.has('Shift+e')).toBe(false);
    expect(keymap.navigation.get('q')?.line).toBe('/quote {label}');
  });

  it('leaves local out of /vis on a Mastodon', () => {
    const { registry } = renderRegistry(BOTH).result.current;

    expect(registry.byName.get('vis')?.usage).toBe('/vis [public|unlisted|private|direct] [text]');
  });

  it('brings the commands back on a Wired once the account is switched', () => {
    const { result } = renderRegistry(BOTH);

    act(() => {
      result.current.dispatch({ type: 'accounts', accounts: [ALICE, WANDA], activeKey: WANDA.key });
    });
    const { registry } = result.current;

    expect(registry.byName.has('react')).toBe(true);
    expect(registry.byName.has('forgot')).toBe(true);
    expect(registry.byName.get('vis')?.usage).toBe(
      '/vis [public|unlisted|private|direct|local] [text]',
    );
  });

  it('binds Shift+e to /react on a Wired', () => {
    const { result } = renderRegistry(BOTH);

    act(() => {
      result.current.dispatch({ type: 'accounts', accounts: [ALICE, WANDA], activeKey: WANDA.key });
    });

    expect(buildKeymap(result.current.registry).navigation.get('Shift+e')?.line).toBe(
      '/react {label}',
    );
  });

  it('keeps the same registry while nothing it depends on changes', () => {
    const { result, rerender } = renderRegistry(BOTH);
    const first = result.current.registry;

    rerender();

    expect(result.current.registry).toBe(first);
  });
});
