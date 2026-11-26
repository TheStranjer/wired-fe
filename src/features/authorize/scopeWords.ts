/**
 * The permissions an app asks for, in plain words (WFE-168). A scope is a
 * verb, optionally narrowed by a noun (`read:statuses`) and optionally made
 * administrative (`admin:read`); the verbs WiredFE knows get a sentence and
 * anything else is shown as it came, so nothing the app asks for is hidden.
 * Pure.
 */

import type { MessageKey } from '../../i18n/messages';
import { t } from '../../i18n/translate';

/** A scope: an optional `admin:`, a known verb, an optional narrowing noun. */
const SCOPE = /^(admin:)?(read|write|follow|push)(?::([a-z_:]+))?$/u;

/** The message saying what each verb lets an app do without a noun. */
const WHOLE: Readonly<Record<string, MessageKey | undefined>> = {
  read: 'features.authorize.whole_read',
  write: 'features.authorize.whole_write',
  follow: 'features.authorize.whole_follow',
  push: 'features.authorize.whole_push',
};

/** The message for each verb narrowed by a noun. */
const NARROW: Readonly<Record<string, MessageKey | undefined>> = {
  read: 'features.authorize.narrow_read',
  write: 'features.authorize.narrow_write',
  follow: 'features.authorize.narrow_follow',
  push: 'features.authorize.narrow_push',
};

/** A scope as one line of plain words, with the scope itself in brackets. */
export function describeScope(scope: string): string {
  const [, admin, verb = '', noun] = SCOPE.exec(scope) ?? [];
  const key = noun === undefined ? WHOLE[verb] : NARROW[verb];
  if (key === undefined) {
    return t('features.authorize.scope_unknown', { scope });
  }
  const words = t(key, { noun: (noun ?? '').replaceAll(/[_:]/gu, ' ') });
  return t(
    admin === undefined ? 'features.authorize.scope_plain' : 'features.authorize.scope_admin',
    {
      words,
      scope,
    },
  );
}
