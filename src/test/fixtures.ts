/**
 * The entity fixtures shared by the tests that need real parsed data: the
 * smallest Status and Notification the schemas accept, so a test asserts against
 * the same shape an API answer gives the app (decision 7). Tests that need more
 * pass `extras` to {@link status}; the schemas fill in the rest.
 */

import * as v from 'valibot';

import { type Notification, NotificationSchema } from '../api/schemas/notification';
import { type Status, StatusSchema } from '../api/schemas/status';

/** The moment every test entity is stamped with, so dates compare by value. */
export const TEST_DATE = '2026-11-12T21:14:05.000Z';

/** The author every test status shares, in the shape the schema reads. */
const ACCOUNT = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain',
  created_at: TEST_DATE,
  note: '<p>hi</p>',
  url: 'https://wired.example/@lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** A status parsed from the smallest wire object the schema accepts, plus `extras`. */
export function status(id: string, extras: Record<string, unknown> = {}): Status {
  return v.parse(StatusSchema, {
    id,
    uri: `https://wired.example/n/${id}`,
    created_at: TEST_DATE,
    account: ACCOUNT,
    content: `<p>${id}</p>`,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    ...extras,
  });
}

/** A notification parsed from the schema's smallest wire object: `post` may be null. */
export function notification(id: string, post: Status | null): Notification {
  return v.parse(NotificationSchema, {
    id,
    type: post === null ? 'follow' : 'mention',
    created_at: TEST_DATE,
    account: ACCOUNT,
    status: post,
  });
}
