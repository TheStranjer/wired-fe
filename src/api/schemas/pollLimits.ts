/**
 * Poll limits and the small extractors the instance schemas (decision 5)
 * share. Mastodon's `configuration.polls` blocks spell their keys
 * max_options, max_characters_per_option, min_expiration and max_expiration;
 * Pleroma's top-level `poll_limits` renames the second to max_option_chars.
 * A block is only trusted when all four numbers are present as non-negative
 * integers; a partial or malformed block yields null without failing the
 * whole document.
 */

import { isRecord } from '../../lib/guards';

/** How far a poll may reach on an instance: options, characters, seconds. */
export type PollLimits = {
  readonly maxOptions: number;
  readonly maxCharactersPerOption: number;
  readonly minExpiration: number; // seconds
  readonly maxExpiration: number; // seconds
};

/** Reads `key` from an unknown value: undefined unless it is an object. */
export function readKey(source: unknown, key: string): unknown {
  return isRecord(source) ? source[key] : undefined;
}

/** Returns `value` when it is a non-negative integer, otherwise null. */
export function nonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * The {@link PollLimits} of an unknown poll block, or null when the block is
 * absent, not an object, or any of its four numbers is not a non-negative
 * integer. `optionKey` names the option-length key of that document:
 * `max_characters_per_option` on Mastodon, `max_option_chars` on Pleroma.
 */
export function extractPollLimits(block: unknown, optionKey: string): PollLimits | null {
  const maxOptions = nonNegativeInt(readKey(block, 'max_options'));
  const maxCharactersPerOption = nonNegativeInt(readKey(block, optionKey));
  const minExpiration = nonNegativeInt(readKey(block, 'min_expiration'));
  const maxExpiration = nonNegativeInt(readKey(block, 'max_expiration'));
  if (
    maxOptions === null ||
    maxCharactersPerOption === null ||
    minExpiration === null ||
    maxExpiration === null
  ) {
    return null;
  }
  return { maxOptions, maxCharactersPerOption, minExpiration, maxExpiration };
}
