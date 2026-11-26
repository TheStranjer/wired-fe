/**
 * `/pin` (decision 6): keep one of your own posts at the top of your profile,
 * or take it back down when it stands there already. Only the author pins, so a
 * post of anybody else is refused before anything leaves. A leading label or
 * the navigation selection names the post, as {@link runStatusToggle}
 * describes; `Shift+p` in navigation mode runs it on the selected post.
 * `/unpin` always takes it back.
 */

import { t } from '../../i18n/translate';
import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/pin` definition. */
export const command: CommandDefinition = {
  name: 'pin',
  get usage(): string {
    return t('commands.defs.pin.usage');
  },
  get summary(): string {
    return t('commands.defs.pin.summary');
  },
  run: toggleRun('pin'),
  bindings: [{ mode: 'navigation', chord: 'Shift+p', args: '' }],
};
