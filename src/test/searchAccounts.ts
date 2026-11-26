/**
 * The account an accounts search for `@al` finds, as each backend records it
 * (WFE-300): Wired's plain document, Mastodon's with the `source`, `roles`
 * and `noindex` extras, Pleroma's with its `pleroma` block. All three parse
 * to the same {@link Account}, which is what the tests of the handle search
 * check.
 */

/** The fields every backend sends for an account. */
const BASE = {
  id: '109',
  username: 'alex',
  acct: 'alex@o.example',
  display_name: 'Alex Mercer',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>Close the world.</p>',
  url: 'https://o.example/users/alex',
  avatar: 'https://o.example/avi.png',
  header: 'https://o.example/banner.png',
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** The account as Wired records it. */
export const WIRED_ACCOUNT: Record<string, unknown> = { ...BASE, fqn: 'alex@o.example' };

/** The account as each backend records it, by the backend's name. */
export const BACKENDS: readonly (readonly [name: string, wire: Record<string, unknown>])[] = [
  ['Wired', WIRED_ACCOUNT],
  ['Mastodon', { ...BASE, source: { privacy: 'public' }, roles: [], noindex: false }],
  ['Pleroma', { ...BASE, pleroma: { is_admin: false, is_moderator: false, tags: [] } }],
];
