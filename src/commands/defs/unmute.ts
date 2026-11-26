/**
 * `/unmute [target]` (decision 6): take a mute back, however
 * long or short it was. The target resolves like the other account commands'
 * and the instance's relationship answer is printed as `unmuted @x`; what
 * {@link accountToggleRun} describes is the body.
 */

import { t } from '../../i18n/translate';
import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/unmute` definition. */
export const command: CommandDefinition = {
  name: 'unmute',
  get usage(): string {
    return t('commands.defs.unmute.usage');
  },
  get summary(): string {
    return t('commands.defs.unmute.summary');
  },
  run: accountToggleRun('unmute', 'unmuted'),
};
