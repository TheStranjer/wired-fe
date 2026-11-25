/**
 * Tests for dispatching a command the active account's backend cannot do
 * (WFE-172): typed anyway, it prints the one human refusal instead of
 * "unknown command" and never runs; a really unknown name still says so.
 */
import { describe, expect, it, vi } from 'vitest';

import { availableCommands } from './available';
import { dispatchInput } from './dispatch';
import { buildRegistry } from './registry';
import type { CommandDefinition } from './types';
import { MASTODON_CAPABILITIES } from '../capabilities/testCapabilities';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { accountOn, signedInOn } from '../test/backendSessions';
import { fakeCommandContext } from '../test/commandContext';

const run = vi.fn<CommandDefinition['run']>().mockResolvedValue({ ok: true });

/** A context signed in as alice on a Mastodon, with `/react` gated on reactions. */
function mastodonContext(): ReturnType<typeof fakeCommandContext> {
  const built = buildRegistry([
    { name: 'react', usage: '/react', summary: 'React', run, requires: 'emojiReactions' },
  ]);
  if (!built.ok) {
    throw new Error(built.error);
  }
  const account = accountOn('https://mastodon.test', 'alice@mastodon.test');
  const state = signedInOn(account, MASTODON_CAPABILITIES).reduce(appReducer, initialAppState());
  const registry = availableCommands(built.value, {
    signedIn: true,
    capabilities: MASTODON_CAPABILITIES,
  });
  return fakeCommandContext({ state, registry });
}

describe('dispatching a command the backend cannot do', () => {
  it('prints the human refusal and does not run it', async () => {
    const context = mastodonContext();

    await dispatchInput('/react a1 🔥', context, vi.fn());

    expect(context.print).toHaveBeenCalledWith(
      "@alice@mastodon.test's server (Mastodon) can't react to posts with emoji",
      'error',
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('still calls a name nobody knows unknown', async () => {
    const context = mastodonContext();

    await dispatchInput('/nope', context, vi.fn());

    expect(context.print).toHaveBeenCalledWith('Unknown command: /nope. Try /help', 'error');
  });
});
