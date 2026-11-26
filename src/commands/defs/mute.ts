/**
 * `/mute [target] [duration]` (decision 6): mute an account as
 * the window's own, for a while or forever. The target resolves like the
 * other account commands'; the word after it is a duration — `30m`, `2h`,
 * `7d` — sent as seconds and echoed in the printed line, `muted @x for 30m`.
 * No duration mutes forever. A word that spells no duration is refused
 * before anything is sent; what {@link accountToggleRun} describes is the
 * body. `Shift+M` in navigation mode prefills the line, so the duration can
 * be typed after the author of the selected post; a click on a card's `⋯` →
 * Mute author (WFE-267) instead opens a dialog choosing the duration, and runs
 * the same line with that duration word on the end.
 */

import { t } from '../../i18n/translate';
import { accountToggleRun } from '../accountToggle';
import type { CommandDefinition } from '../types';

/** The `/mute` definition. */
export const command: CommandDefinition = {
  name: 'mute',
  get usage(): string {
    return t('commands.defs.mute.usage');
  },
  get summary(): string {
    return t('commands.defs.mute.summary');
  },
  run: accountToggleRun('mute', 'muted'),
  bindings: [{ mode: 'navigation', chord: 'Shift+m', args: '{label}', prefill: true }],
};
