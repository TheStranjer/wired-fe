/**
 * `/bookmark` (decision 6): keep a post in your own bookmarks, or take it out
 * again when it is already kept there. Nothing leaves the instance's sight: a
 * bookmark is private to the account, unlike a boost. A leading label or the
 * navigation selection names the post and a boost names its original, as
 * {@link runStatusToggle} describes; `Shift+b` in navigation mode runs it on
 * the selected post. `/unbookmark` always takes it back.
 */

import { t } from '../../i18n/translate';
import { toggleRun } from '../statusToggle';
import type { CommandDefinition } from '../types';

/** The `/bookmark` definition. */
export const command: CommandDefinition = {
  name: 'bookmark',
  get usage(): string {
    return t('commands.defs.bookmark.usage');
  },
  get summary(): string {
    return t('commands.defs.bookmark.summary');
  },
  run: toggleRun('bookmark'),
  bindings: [{ mode: 'navigation', chord: 'Shift+b', args: '' }],
};
