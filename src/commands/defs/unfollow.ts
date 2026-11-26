/**
 * `/unfollow [target]` (decision 6): take a follow back. The
 * target resolves like the other account commands' and the instance's
 * relationship answer is printed as `unfollowed @x`; what
 * {@link accountToggleRun} describes is the body.
 */

import { t } from '../../i18n/translate';
import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/unfollow` definition. */
export const command: CommandDefinition = {
  name: 'unfollow',
  get usage(): string {
    return t('commands.defs.unfollow.usage');
  },
  get summary(): string {
    return t('commands.defs.unfollow.summary');
  },
  run: accountToggleRun('unfollow', 'unfollowed'),
};
