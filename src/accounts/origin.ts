/**
 * Which instance origin the app talks to (decision 3), resolved from the
 * build's mode plus what the user typed. Pure: the page origin arrives as a
 * parameter and there is no `window` access, so every mode is unit-testable.
 */

import type { InstancesConfig } from '../config/schema';
import { t } from '../i18n/translate';
import { type InstanceChoices, isAllowedInstanceUrl } from '../lib/origin';
import { type Result, err, ok } from '../lib/result';

/** A leading `scheme://` on user input, per RFC 3986. */
const SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;

/** Shown when the input is empty or does not parse as a host. */
function needInstance(): string {
  return t('accounts.need_instance');
}

/** Shown when the parsed URL is not `https:` (or local `http:`). */
function needHttps(): string {
  return t('accounts.need_https');
}

/** Shown on a `list` build when the typed origin is not one of the options. */
function notListed(): string {
  return t('accounts.not_listed');
}

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
 * Missing input or unparsable hosts get {@link needInstance}; non-`https`
 * hosts that are not local get {@link needHttps}.
 */
export function normalizeTypedOrigin(typed: string): Result<string, string> {
  const input = stripMention(typed.trim());
  if (input === '') {
    return err(needInstance());
  }
  const candidate = SCHEME_PREFIX.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(candidate);
    return isAllowedInstanceUrl(url) ? ok(url.origin) : err(needHttps());
  } catch {
    return err(needInstance());
  }
}

/**
 * On a `list` build a listed origin is accepted; any other valid typed origin
 * only when {@link allowCustom}, otherwise {@link notListed}.
 */
function fromList(origins: readonly string[], allowCustom: boolean, typed: string): OriginChoice {
  const normalized = normalizeTypedOrigin(typed);
  if (normalized.ok && origins.includes(normalized.value)) {
    return normalized;
  }
  return allowCustom ? normalized : err(notListed());
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

/**
 * Whether the user's own input picked {@link origin} as the instance (WFE-343):
 * an `open` build always, a `list` build with `allowCustom` when the origin is
 * not one of the listed ones. `same-origin`, `fixed` and listed hosts ignore
 * or vouch for the input, so there is nothing to second-guess.
 */
export function isTypedInstance(instances: InstancesConfig, origin: string): boolean {
  switch (instances.mode) {
    case 'open':
      return true;
    case 'list':
      return instances.allowCustom === true && !instances.origins.includes(origin);
    case 'same-origin':
    case 'fixed':
      return false;
  }
}

/**
 * What a visitor may pick from on {@link instances}: the listed origins of a
 * `list` build, and whether they may type another. Null when there is nothing
 * to pick from (every other mode, and a list with no origins), which leaves the
 * instance a free text field when the build asks at all.
 */
export function instanceChoices(instances: InstancesConfig): InstanceChoices | null {
  if (instances.mode !== 'list' || instances.origins.length === 0) {
    return null;
  }
  return { origins: instances.origins, allowCustom: instances.allowCustom === true };
}

/** The origin to start a form with: the only one on offer, otherwise none (`''`). */
export function preselectedOrigin(choices: InstanceChoices | null | undefined): string {
  const [first, ...rest] = choices?.origins ?? [];
  return first !== undefined && rest.length === 0 ? first : '';
}
