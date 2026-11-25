/**
 * Tests for /help on a backend that cannot do everything (WFE-172): the list
 * leaves out what the active account's server cannot do, the detail of such a
 * command says why instead of describing it, and switching to an account on
 * another backend brings the commands back.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './help';
import type { Capabilities } from '../../capabilities/capabilities';
import { MASTODON_CAPABILITIES, WIRED_CAPABILITIES } from '../../capabilities/testCapabilities';
import { initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { accountOn, signedInOn } from '../../test/backendSessions';
import { fakeCommandContext } from '../../test/commandContext';
import { availableCommands } from '../available';
import { loadDefinitions } from '../definitions';
import { buildRegistry } from '../registry';
import type { CommandContext } from '../types';

/** A context signed in on {@link capabilities}, over the shipped commands narrowed to them. */
function contextOn(handle: string, capabilities: Capabilities): CommandContext {
  const definitions = loadDefinitions();
  if (!definitions.ok) {
    throw new Error(definitions.error);
  }
  const built = buildRegistry(definitions.value);
  if (!built.ok) {
    throw new Error(built.error);
  }
  const account = accountOn('https://test.example', handle);
  const state = signedInOn(account, capabilities).reduce(appReducer, initialAppState());
  const registry = availableCommands(built.value, { signedIn: true, capabilities });
  return fakeCommandContext({ state, registry });
}

/** Every line {@link context} printed, in order. */
function printed(context: CommandContext): readonly string[] {
  return vi.mocked(context.print).mock.calls.map(([text]) => text);
}

describe('/help on a Mastodon', () => {
  it('leaves out /react, /unreact and /forgot but keeps /quote', async () => {
    const context = contextOn('alice@mastodon.test', MASTODON_CAPABILITIES);

    await command.run('', context);
    const lines = printed(context).join('\n');

    expect(lines).not.toContain('/react ');
    expect(lines).not.toContain('/unreact');
    expect(lines).not.toContain('/forgot');
    expect(lines).toContain('/quote');
    expect(lines).toContain('/help');
  });

  it('shows /vis without local', async () => {
    const context = contextOn('alice@mastodon.test', MASTODON_CAPABILITIES);

    await command.run('vis', context);

    expect(printed(context)[0]).toBe('/vis [public|unlisted|private|direct]');
  });

  it('says why a hidden command is hidden', async () => {
    const context = contextOn('alice@mastodon.test', MASTODON_CAPABILITIES);

    const outcome = await command.run('/react', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@alice@mastodon.test's server (Mastodon) can't react to posts with emoji",
    });
  });
});

describe('/help on a Wired', () => {
  it('lists the commands the Mastodon lacks and /vis with local', async () => {
    const context = contextOn('wanda@wired.test', WIRED_CAPABILITIES);

    await command.run('', context);
    const lines = printed(context).join('\n');
    await command.run('vis', context);

    expect(lines).toContain('/react ');
    expect(lines).toContain('/unreact');
    expect(lines).toContain('/forgot');
    expect(printed(context)).toContain('/vis [public|unlisted|private|direct|local]');
  });
});
