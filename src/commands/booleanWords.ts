/**
 * The words a switch takes on the command line (`/set`, `/display`): the
 * value each means and how a value prints back, shared so every command that
 * turns something on or off speaks the same words.
 */

/** The words a boolean takes and the value each means. */
export const BOOLEAN_MEANINGS: ReadonlyMap<string, boolean> = new Map([
  ['on', true],
  ['true', true],
  ['yes', true],
  ['off', false],
  ['false', false],
  ['no', false],
]);

/** The words listed when a switch refuses its value. */
export const BOOLEAN_WORDS = 'on|off|true|false|yes|no';

/** How a value reads: booleans say on and off, the rest speak for themselves. */
export function shown(value: string | boolean): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }
  return value;
}
