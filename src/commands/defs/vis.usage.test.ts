/**
 * Tests for the words /vis and /set defaultVisibility take per backend
 * (WFE-172): the usage lists `local` only where the instance has local-only
 * posts, and /set refuses `local` elsewhere in the same human words as /vis.
 */
import { describe, expect, it } from 'vitest';

import { command as set } from './set';
import { command as vis } from './vis';
import type { Capabilities } from '../../capabilities/capabilities';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../../capabilities/testCapabilities';
import { initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { accountOn, signedInOn } from '../../test/backendSessions';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context signed in on an instance of {@link capabilities}. */
function contextOn(capabilities: Capabilities): CommandContext {
  const account = accountOn('https://test.example', 'alice@test.example');
  const state = signedInOn(account, capabilities).reduce(appReducer, initialAppState());
  return fakeCommandContext({ state });
}

describe('/vis usage', () => {
  it('lists local on a backend with local-only posts', () => {
    expect(vis.usageFor?.(WIRED_CAPABILITIES)).toBe(
      '/vis [public|unlisted|private|direct|local] [text]',
    );
    expect(vis.usage).toBe('/vis [public|unlisted|private|direct|local] [text]');
  });

  it('leaves local out on a Mastodon and while nothing is known', () => {
    expect(vis.usageFor?.(MASTODON_CAPABILITIES)).toBe(
      '/vis [public|unlisted|private|direct] [text]',
    );
    expect(vis.usageFor?.(null)).toBe('/vis [public|unlisted|private|direct] [text]');
  });
});

describe('/set defaultVisibility', () => {
  it('refuses local on a Mastodon in human words', async () => {
    const context = contextOn(MASTODON_CAPABILITIES);

    const outcome = await set.run('defaultVisibility local', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@alice@test.example's server (Mastodon) can't post local-only",
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('accepts local on a Wired', async () => {
    const context = contextOn(WIRED_CAPABILITIES);

    const outcome = await set.run('defaultVisibility local', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { defaultVisibility: 'local' },
    });
  });

  it('lists only the words the backend has when a word is refused', async () => {
    const context = contextOn(MASTODON_CAPABILITIES);

    const outcome = await set.run('defaultVisibility nope', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'defaultVisibility takes public|unlisted|private|direct',
    });
  });
});
