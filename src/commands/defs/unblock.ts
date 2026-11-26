/**
 * `/unblock [target]` (decision 6): take a block back. The
 * target resolves like the other account commands' and the instance's
 * relationship answer is printed as `unblocked @x`; what
 * {@link accountToggleRun} describes is the body.
 */

import { t } from '../../i18n/translate';
import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/unblock` definition. */
export const command: CommandDefinition = {
  name: 'unblock',
  get usage(): string {
    return t('commands.defs.unblock.usage');
  },
  get summary(): string {
    return t('commands.defs.unblock.summary');
  },
  run: accountToggleRun('unblock', 'unblocked'),
};
