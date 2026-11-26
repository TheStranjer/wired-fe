/**
 * Which instance origin the app talks to (decision 3), resolved from the
 * build's mode plus what the user typed. Pure: the page origin arrives as a
 * parameter and there is no `window` access, so every mode is unit-testable.
 */

import type { InstancesConfig } from '../config/schema';
import { isAllowedInstanceUrl } from '../lib/origin';
import { type Result, err, ok } from '../lib/result';

/** A leading `scheme://` on user input, per RFC 3986. */
const SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;

/** Shown when the input is empty or does not parse as a host. */
const NEED_INSTANCE = 'Enter an instance, like wired.example';

/** Shown when the parsed URL is not `https:` (or local `http:`). */
const NEED_HTTPS = 'Only https instances are supported';

/** Shown on a `list` build when the typed origin is not one of the options. */
const NOT_LISTED = 'That instance is not available here';

/** The chosen instance origin, or a message to show the user. */
export type OriginChoice = Result<string, string>;

/** Drops a leading `@user@` mention, keeping the host after the last `@`. */
function stripMention(typed: string): string {
  if (!typed.startsWith('@')) {
    return typed;
  }
  return typed.slice(typed.lastIndexOf('@') + 1);
}

/**
 * Normalizes what the user typed (`wired.example`, `https://wired.example/`,
 * `@me@wired.example`) into a bare origin like `https://wired.example`.
 * Missing input or unparsable hosts get {@link NEED_INSTANCE}; non-`https`
 * hosts that are not local get {@link NEED_HTTPS}.
 */
export function normalizeTypedOrigin(typed: string): Result<string, string> {
  const input = stripMention(typed.trim());
  if (input === '') {
    return err(NEED_INSTANCE);
  }
  const candidate = SCHEME_PREFIX.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(candidate);
    return isAllowedInstanceUrl(url) ? ok(url.origin) : err(NEED_HTTPS);
  } catch {
    return err(NEED_INSTANCE);
  }
}

/**
 * On a `list` build a listed origin is accepted; any other valid typed origin
 * only when {@link allowCustom}, otherwise {@link NOT_LISTED}.
 */
function fromList(origins: readonly string[], allowCustom: boolean, typed: string): OriginChoice {
  const normalized = normalizeTypedOrigin(typed);
  if (normalized.ok && origins.includes(normalized.value)) {
    return normalized;
  }
  return allowCustom ? normalized : err(NOT_LISTED);
}

/**
 * The instance origin to use for {@link instances}' mode (decision 3):
 * `same-origin` takes the page's own origin, `fixed` the configured one,
 * `list` accepts a typed origin that is on the list (any valid one too, with
 * `allowCustom`), and `open` takes whatever valid instance the user typed.
 */
export function resolveInstanceOrigin(
  instances: InstancesConfig,
  pageOrigin: string,
  typed: string,
): OriginChoice {
  switch (instances.mode) {
    case 'same-origin':
      return ok(pageOrigin);
    case 'fixed':
      return ok(instances.origin);
    case 'list':
      return fromList(instances.origins, instances.allowCustom === true, typed);
    case 'open':
      return normalizeTypedOrigin(typed);
  }
}
