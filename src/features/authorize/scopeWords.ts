/**
 * The permissions an app asks for, in plain words (WFE-168). A scope is a
 * verb, optionally narrowed by a noun (`read:statuses`) and optionally made
 * administrative (`admin:read`); the verbs WiredFE knows get a sentence and
 * anything else is shown as it came, so nothing the app asks for is hidden.
 * Pure.
 */

/** A scope: an optional `admin:`, a known verb, an optional narrowing noun. */
const SCOPE = /^(admin:)?(read|write|follow|push)(?::([a-z_:]+))?$/u;

/** What each verb lets an app do without a noun. */
const WHOLE: Readonly<Record<string, string | undefined>> = {
  read: 'Read everything you can see',
  write: 'Post, edit and delete as you',
  follow: 'Follow, unfollow, block and mute accounts',
  push: 'Send you push notifications',
};

/** The words before a narrowing noun, per verb. */
const NARROW: Readonly<Record<string, string | undefined>> = {
  read: 'Read your',
  write: 'Change your',
  follow: 'Manage your',
  push: 'Push notifications for your',
};

/** A scope as one line of plain words, with the scope itself in brackets. */
export function describeScope(scope: string): string {
  const [, admin, verb = '', noun] = SCOPE.exec(scope) ?? [];
  const words =
    noun === undefined ? WHOLE[verb] : `${NARROW[verb] ?? ''} ${noun.replaceAll(/[_:]/gu, ' ')}`;
  if (words === undefined) {
    return `Unknown permission (${scope})`;
  }
  return `${admin === undefined ? '' : 'As an administrator: '}${words} (${scope})`;
}
