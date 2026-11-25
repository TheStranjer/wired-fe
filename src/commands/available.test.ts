/**
 * Tests for the capability narrowing of the registry (WFE-172): a command with
 * `requires` exists only where the backend carries every flag, nobody signed
 * in narrows nothing, a signed-in account of unknown capabilities loses the
 * gated commands, `usageFor` rewrites the usage per backend, and a hidden
 * command typed anyway is refused in the human words of requireFeature.
 */
import { describe, expect, it } from 'vitest';

import { availableCommands, unavailableRefusal } from './available';
import { buildRegistry } from './registry';
import type { CommandDefinition, Registry } from './types';
import {
  MASTODON_CAPABILITIES,
  WIRED_CAPABILITIES,
  capabilitiesOn,
} from '../capabilities/testCapabilities';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { accountOn, signedInOn } from '../test/backendSessions';
import { fakeCommandContext } from '../test/commandContext';

/** A definition named {@link name} with the extra fields in {@link more}. */
function define(name: string, more: Partial<CommandDefinition> = {}): CommandDefinition {
  return {
    name,
    usage: `/${name}`,
    summary: `Do ${name}`,
    run: async () => await Promise.resolve({ ok: true }),
    ...more,
  };
}

/** The registry of a free command, a reaction one with an alias, a two-flag one and a vis-like one. */
function registry(): Registry {
  const built = buildRegistry([
    define('home'),
    define('react', { aliases: ['rx'], requires: 'emojiReactions' }),
    define('both', { requires: ['emojiReactions', 'quotePosting'] }),
    define('vis', { usageFor: (caps) => (caps === null ? '/vis none' : '/vis some') }),
  ]);
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** The names of the commands {@link available} lists. */
function names(available: Registry): readonly string[] {
  return available.commands.map((definition) => definition.name);
}

describe(availableCommands, () => {
  it('lists every command for a backend that carries the flags', () => {
    const available = availableCommands(registry(), {
      signedIn: true,
      capabilities: WIRED_CAPABILITIES,
    });

    expect(names(available)).toStrictEqual(['both', 'home', 'react', 'vis']);
    expect(available.byName.get('rx')?.name).toBe('react');
  });

  it('hides commands whose flag the backend lacks, aliases and all', () => {
    const available = availableCommands(registry(), {
      signedIn: true,
      capabilities: MASTODON_CAPABILITIES,
    });

    expect(names(available)).toStrictEqual(['home', 'vis']);
    expect(available.byName.has('rx')).toBe(false);
    expect(available.hidden?.get('rx')?.name).toBe('react');
    expect(available.hidden?.get('both')?.name).toBe('both');
  });

  it('needs every flag of a command that names several', () => {
    const quoting = capabilitiesOn('mastodon', ['quotePosting']);
    const reacting = capabilitiesOn('pleroma', ['emojiReactions']);

    const lacking = availableCommands(registry(), { signedIn: true, capabilities: quoting });
    const lackingOther = availableCommands(registry(), { signedIn: true, capabilities: reacting });

    expect(names(lacking)).not.toContain('both');
    expect(names(lackingOther)).not.toContain('both');
  });

  it('shows everything while nobody is signed in', () => {
    const available = availableCommands(registry(), { signedIn: false, capabilities: null });

    expect(names(available)).toStrictEqual(['both', 'home', 'react', 'vis']);
    expect(available.hidden?.size).toBe(0);
  });

  it('hides the gated commands of an account whose instance is not known', () => {
    const available = availableCommands(registry(), { signedIn: true, capabilities: null });

    expect(names(available)).toStrictEqual(['home', 'vis']);
  });

  it('shows the usage the backend gives', () => {
    const known = availableCommands(registry(), {
      signedIn: true,
      capabilities: MASTODON_CAPABILITIES,
    });
    const unknown = availableCommands(registry(), { signedIn: true, capabilities: null });

    expect(known.byName.get('vis')?.usage).toBe('/vis some');
    expect(unknown.byName.get('vis')?.usage).toBe('/vis none');
    expect(known.byName.get('home')?.usage).toBe('/home');
  });
});

describe(unavailableRefusal, () => {
  /** A context signed in on Mastodon over the registry narrowed to it. */
  function mastodonContext(): ReturnType<typeof fakeCommandContext> {
    const account = accountOn('https://mastodon.test', 'alice@mastodon.test');
    const state = signedInOn(account, MASTODON_CAPABILITIES).reduce(appReducer, initialAppState());
    const narrowed = availableCommands(registry(), {
      signedIn: true,
      capabilities: MASTODON_CAPABILITIES,
    });
    return fakeCommandContext({ state, registry: narrowed });
  }

  it("says what the account's server cannot do, by name or alias", () => {
    const context = mastodonContext();

    expect(unavailableRefusal(context, 'react')).toBe(
      "@alice@mastodon.test's server (Mastodon) can't react to posts with emoji",
    );
    expect(unavailableRefusal(context, 'rx')).toBe(unavailableRefusal(context, 'react'));
  });

  it('names the first flag a command lacks when it needs several', () => {
    expect(unavailableRefusal(mastodonContext(), 'both')).toContain("can't react");
  });

  it('is null for a command that is not hidden', () => {
    const context = mastodonContext();

    expect(unavailableRefusal(context, 'home')).toBeNull();
    expect(unavailableRefusal(context, 'nonsense')).toBeNull();
  });

  it('is null when the registry hid nothing', () => {
    expect(unavailableRefusal(fakeCommandContext(), 'react')).toBeNull();
  });
});
