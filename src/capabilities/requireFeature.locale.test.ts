/**
 * Tests that the capability refusals follow the language in use (WFE-316,
 * decision 19): each flag has its own sentence in the catalog, which names the
 * server's owner and backend through arguments, so a fake language replaces it.
 */
import { describe, expect, it } from 'vitest';

import { type Capabilities, DEFAULT_POLL_LIMITS } from './capabilities';
import { requireFeature } from './requireFeature';
import { installFakeLocale } from '../test/i18n';

const ORIGIN = 'https://mastodon.test';

/** Capabilities of a Mastodon server that carries nothing. */
const BARE: Capabilities = {
  backend: 'mastodon',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(),
};

/** The gate's context with alice signed in, or nobody when {@link signedIn} is false. */
function contextWith(signedIn: boolean): Parameters<typeof requireFeature>[0] {
  return {
    state: {
      accounts: signedIn ? [{ key: 'alice', origin: ORIGIN, handle: 'alice@mastodon.test' }] : [],
      profiles: new Map([[ORIGIN, { capabilities: BARE }]]),
    },
  };
}

describe('requireFeature in another language', () => {
  it('words the refusal of a flag from the catalog, with the owner and the backend', () => {
    installFakeLocale({
      capabilities: {
        cannot: {
          editing: 'XX {owner}/{handle}{brand} cannot edit',
          markdown: 'XX {owner}{handle}{brand} md',
        },
      },
    });

    expect(requireFeature(contextWith(true), 'alice', 'editing')).toStrictEqual({
      ok: false,
      error: 'XX handle/alice@mastodon.test (Mastodon) cannot edit',
    });
    expect(requireFeature(contextWith(false), null, 'markdown')).toStrictEqual({
      ok: false,
      error: 'XX none md',
    });
  });
});
