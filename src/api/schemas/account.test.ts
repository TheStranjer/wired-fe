/**
 * Tests for the Account schema: a Wired account with its `pleroma` block and the
 * extras around it, a Mastodon 4.x account that has neither, the minimal account
 * that gets every default, `moved` parsed recursively, and the inputs that fail
 * outright — a missing required field, a negative or fractional counter.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { Account, AccountPleroma } from './account';
import { AccountSchema } from './account';

const AVATAR = 'https://wired.example/avatars/lain.png';
const AVATAR_STILL = 'https://wired.example/avatars/lain-0.png';
const HEADER = 'https://wired.example/headers/lain.jpg';
const HEADER_STILL = 'https://wired.example/headers/lain-0.jpg';
const EMOJI = 'https://wired.example/emoji/lain.gif';
const SITE = '<a href="https://nxt.example">nxt</a>';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Account {
  const result = v.safeParse(AccountSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** The twelve fields every backend sends, as Wired reports them. */
const REQUIRED = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain Iwakura',
  created_at: '1998-07-06T00:00:00.000Z',
  note: '<p>Close the world. Open the nExt.</p>',
  url: 'https://wired.example/users/lain',
  avatar: AVATAR,
  header: HEADER,
  followers_count: 12,
  following_count: 34,
  statuses_count: 56,
};

/** Every required key, each dropped in turn to show the parser needs it. */
const REQUIRED_KEYS: readonly (keyof typeof REQUIRED)[] = [
  'id',
  'username',
  'acct',
  'display_name',
  'created_at',
  'note',
  'url',
  'avatar',
  'header',
  'followers_count',
  'following_count',
  'statuses_count',
];

/** What {@link REQUIRED} parses to: every optional default applied. */
const REQUIRED_PARSED: Account = {
  ...REQUIRED,
  fqn: null,
  locked: false,
  bot: false,
  group: false,
  discoverable: null,
  uri: null,
  avatar_static: AVATAR,
  header_static: HEADER,
  last_status_at: null,
  emojis: [],
  fields: [],
  moved: null,
  pleroma: null,
};

/** Another account, as it arrives nested in someone's `moved`. */
const ALICE_WIRE = { ...REQUIRED, id: '77', acct: 'alice@other.example', display_name: 'Alice' };

/** {@link ALICE_WIRE} with the same defaults applied. */
const ALICE_PARSED: Account = { ...REQUIRED_PARSED, ...ALICE_WIRE };

/** The five pleroma keys of the Wired account below, the rest of it dropped. */
const WIRED_PLEROMA: AccountPleroma = {
  is_admin: true,
  is_moderator: false,
  accepts_chat_messages: null,
  favicon: 'https://wired.example/favicon.ico',
  background_image: 'https://wired.example/images/bg.png',
};

/** A Wired account: fqn and pleroma block plus keys WiredFE does not model. */
const WIRED_ACCOUNT = {
  ...REQUIRED,
  fqn: 'lain@wired.example',
  locked: true,
  bot: false,
  group: true,
  discoverable: false,
  uri: 'https://wired.example/users/lain',
  avatar_static: AVATAR_STILL,
  header_static: HEADER_STILL,
  last_status_at: '2026-11-13T02:04:00.000Z',
  emojis: [{ shortcode: 'lain', url: EMOJI, static_url: null }],
  fields: [{ name: 'site', value: SITE }],
  moved: null,
  pleroma: {
    ...WIRED_PLEROMA,
    hide_followers: true,
    relationship: { following: false },
    tags: ['ai'],
  },
  source: { privacy: 'public', note: '<p>plain</p>' },
  noindex: false,
};

describe('Account schema', () => {
  it('parses a Wired account, keeping five pleroma keys and dropping the rest', () => {
    expect(parse(WIRED_ACCOUNT)).toStrictEqual({
      ...REQUIRED_PARSED,
      fqn: 'lain@wired.example',
      locked: true,
      group: true,
      discoverable: false,
      uri: 'https://wired.example/users/lain',
      avatar_static: AVATAR_STILL,
      header_static: HEADER_STILL,
      last_status_at: '2026-11-13T02:04:00.000Z',
      emojis: [
        {
          shortcode: 'lain',
          url: EMOJI,
          static_url: EMOJI,
          visible_in_picker: true,
          category: null,
        },
      ],
      fields: [{ name: 'site', value: SITE, verified_at: null }],
      pleroma: WIRED_PLEROMA,
    });
  });

  it('parses a Mastodon 4.x account to a null fqn and a null pleroma block', () => {
    const output = parse({
      ...REQUIRED,
      acct: 'lain@mastodon.example',
      uri: 'https://mastodon.example/users/lain',
      discoverable: true,
      last_status_at: '2026-11-12',
      roles: [],
      role: { id: '1', name: 'Admin', color: '#ff0000' },
      noindex: true,
      source: { privacy: 'public', sensitive: false },
    });

    expect(output.fqn).toBeNull();
    expect(output.pleroma).toBeNull();
    expect(output.moved).toBeNull();
    expect(output.avatar_static).toBe(AVATAR);
    // Nothing but the entity's own keys survives: no roles, role, noindex, source.
    expect(new Set(Object.keys(output))).toStrictEqual(new Set(Object.keys(REQUIRED_PARSED)));
  });

  it('applies every default to the minimal account', () => {
    expect(parse(REQUIRED)).toStrictEqual(REQUIRED_PARSED);
  });

  it('keeps explicit nulls and the still images a backend does send', () => {
    expect(
      parse({
        ...REQUIRED,
        fqn: null,
        uri: null,
        discoverable: null,
        avatar_static: null,
        header_static: null,
        moved: null,
        pleroma: null,
      }),
    ).toStrictEqual(REQUIRED_PARSED);
    expect(parse({ ...REQUIRED, avatar_static: AVATAR_STILL }).avatar_static).toBe(AVATAR_STILL);
  });

  it('defaults the pleroma block a backend sends half-filled', () => {
    expect(parse({ ...REQUIRED, pleroma: { is_admin: true } }).pleroma).toStrictEqual({
      is_admin: true,
      is_moderator: false,
      accepts_chat_messages: null,
      favicon: null,
      background_image: null,
    });
  });

  it('parses a moved account with its own defaults', () => {
    expect(parse({ ...REQUIRED, moved: ALICE_WIRE })).toStrictEqual({
      ...REQUIRED_PARSED,
      moved: ALICE_PARSED,
    });
  });

  it('parses accounts nested deeper than one moved', () => {
    expect(
      parse({ ...REQUIRED, moved: { ...ALICE_WIRE, moved: REQUIRED } }).moved?.moved,
    ).toStrictEqual(REQUIRED_PARSED);
  });

  it.each(REQUIRED_KEYS)('fails without the required %s', (key) => {
    const wire = Object.fromEntries(Object.entries(REQUIRED).filter(([name]) => name !== key));

    expect(v.safeParse(AccountSchema, wire).success).toBe(false);
  });

  it('fails on a negative or fractional counter', () => {
    expect(v.safeParse(AccountSchema, { ...REQUIRED, followers_count: -1 }).success).toBe(false);
    expect(v.safeParse(AccountSchema, { ...REQUIRED, following_count: 2.5 }).success).toBe(false);
    expect(v.safeParse(AccountSchema, { ...REQUIRED, statuses_count: '12' }).success).toBe(false);
  });

  it('fails when a field holds the wrong type', () => {
    expect(v.safeParse(AccountSchema, { ...REQUIRED, note: 42 }).success).toBe(false);
    expect(v.safeParse(AccountSchema, { ...REQUIRED, display_name: null }).success).toBe(false);
    expect(v.safeParse(AccountSchema, { ...REQUIRED, moved: { id: '77' } }).success).toBe(false);
    expect(v.safeParse(AccountSchema, { ...REQUIRED, pleroma: { is_admin: 'yes' } }).success).toBe(
      false,
    );
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(AccountSchema, 'lain').success).toBe(false);
  });
});
