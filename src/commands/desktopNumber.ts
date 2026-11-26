/**
 * The desktop number words of `/desktop` and `/mvd` (decision 18): numbers
 * start at 1 and have no upper bound in the model, but a typo like
 * `/desktop 999999999` must not build a billion desktops, so the command line
 * stops at {@link MAX_DESKTOP}.
 */

import { fail } from './outcome';
import type { CommandOutcome } from './types';
import { t } from '../i18n/translate';

/** The highest desktop number the command line creates. */
const MAX_DESKTOP = 1000;

/** The refusal for a number past {@link MAX_DESKTOP}. */
function tooHigh(): CommandOutcome {
  return fail(t('commands.desktops_up_to', { max: String(MAX_DESKTOP) }));
}

/** Whether {@link text} spells a whole number from 1 (any size). */
export function isDesktopNumber(text: string | undefined): text is string {
  return text !== undefined && /^\d+$/u.test(text) && Number(text) >= 1;
}

/**
 * The desktop number {@link text} spells, or the failure to answer with:
 * {@link unusable} when it spells none, a refusal when it is past the limit.
 */
export function desktopNumber(
  text: string | undefined,
  unusable: CommandOutcome,
): number | CommandOutcome {
  if (!isDesktopNumber(text)) {
    return unusable;
  }
  const number = Number(text);
  return number > MAX_DESKTOP ? tooHigh() : number;
}
