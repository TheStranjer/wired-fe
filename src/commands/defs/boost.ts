/**
 * `/boost` (decision 6, aliases `/rt`, `/reblog`): boost a post — share it with
 * your followers — or take the boost back when the post already carries one. A
 * leading label or the navigation selection names the post and a boost names
 * its original, as {@link runStatusToggle} describes; `b` in navigation mode
 * runs it on the selected post. `/unboost` always takes it back.
 */

import { t } from '../../i18n/translate';
import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/boost` (alias `/rt`, `/reblog`) definition. */
export const command: CommandDefinition = {
  name: 'boost',
  aliases: ['rt', 'reblog'],
  get usage(): string {
    return t('commands.defs.boost.usage');
  },
  get summary(): string {
    return t('commands.defs.boost.summary');
  },
  run: toggleRun('boost'),
  bindings: [{ mode: 'navigation', chord: 'b', args: '' }],
};
