/**
 * `/unboost` (decision 6): take this account's boost of a post back. The same
 * grammar as `/boost`, sent as the undo: a leading label or the navigation
 * selection names the post and a boost names its original, as
 * {@link runStatusToggle} describes. No default hotkey; the typed command, `b`
 * on a boosted post and this help entry reach it.
 */

import { t } from '../../i18n/translate';
import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/unboost` definition. */
export const command: CommandDefinition = {
  name: 'unboost',
  get usage(): string {
    return t('commands.defs.unboost.usage');
  },
  get summary(): string {
    return t('commands.defs.unboost.summary');
  },
  run: toggleRun('unboost'),
};
