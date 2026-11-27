/**
 * The `publicView` build setting (decision 3): whether signed-out visitors may
 * read an instance. `true` forces it on, `false` turns it off, `null` (or no
 * key) leaves it to the backend's published policy, and an object sets each
 * instance by origin. This module holds the schema, the cross-check against
 * `instances` and {@link publicViewSetting}. Instances no one configured (a
 * user-typed one under `allowCustom`, every one in `open` mode) never get
 * public view, so a crafted link cannot make a branded build show a stranger's
 * server to signed-out visitors.
 */

import * as v from 'valibot';

import { type InstancesConfig, ORIGIN_MESSAGE, isDevAllowedOrigin } from './instances';
import type { PublicViewSetting } from '../lib/publicViewSetting';

/** The `publicView` value: one answer for every instance, or one per origin. */
export type PublicViewConfig = boolean | null | Readonly<Record<string, boolean | null>>;

/** The part of the configuration {@link publicViewProblems} and {@link publicViewSetting} read. */
type PublicViewInput = {
  readonly instances: InstancesConfig;
  readonly publicView?: PublicViewConfig | undefined;
};

/** The first key of {@link record} that is not an origin; the message names it. */
function badKeyMessage(record: Readonly<Record<string, unknown>>): string {
  const bad = Object.keys(record).find((key) => !isDevAllowedOrigin(key));
  return `key ${JSON.stringify(bad)} ${ORIGIN_MESSAGE}`;
}

/** The object form: origin keys, each `true`, `false` or `null`. */
const PerInstanceSchema = v.pipe(
  v.record(v.string(), v.nullable(v.boolean())),
  v.check(
    (record) => Object.keys(record).every(isDevAllowedOrigin),
    (issue) => badKeyMessage(issue.input),
  ),
);

/** The schema of the optional `publicView` field. */
export const PublicViewSchema: v.GenericSchema<unknown, PublicViewConfig> = v.union([
  v.boolean(),
  v.null(),
  PerInstanceSchema,
]);

/** The keys of {@link publicView} when it is the object form, else null. */
function objectKeys(publicView: PublicViewConfig | undefined): readonly string[] | null {
  return typeof publicView === 'object' && publicView !== null ? Object.keys(publicView) : null;
}

/** What is wrong with the object form {@link keys} under {@link instances}; none when fine. */
function objectProblems(instances: InstancesConfig, keys: readonly string[]): readonly string[] {
  switch (instances.mode) {
    case 'same-origin':
      return ['the object form needs origins known at build time; use true, false or null'];
    case 'open':
      return ['the object form is not allowed with instances.mode "open"'];
    case 'fixed':
      return keys.every((key) => key === instances.origin)
        ? []
        : [`may only name instances.origin ${instances.origin}`];
    case 'list': {
      const missing = keys.filter((key) => !instances.origins.includes(key));
      return missing.length === 0
        ? []
        : [`names origins missing from instances.origins: ${missing.join(', ')}`];
    }
  }
}

/**
 * What is wrong with {@link config}'s `publicView` given its `instances`: one
 * message, or none when it is fine. `true` and the object form are refused
 * where they cannot apply.
 */
export function publicViewProblems(config: PublicViewInput): readonly string[] {
  const keys = objectKeys(config.publicView);
  if (keys !== null) {
    return objectProblems(config.instances, keys);
  }
  return config.instances.mode === 'open' && config.publicView === true
    ? ['true is not allowed with instances.mode "open"']
    : [];
}

/** True when the build configured {@link origin} as an instance of its own. */
function isConfigured(instances: InstancesConfig, origin: string): boolean {
  switch (instances.mode) {
    case 'same-origin':
      return true;
    case 'fixed':
      return instances.origin === origin;
    case 'list':
      return instances.origins.includes(origin);
    case 'open':
      return false;
  }
}

/** The `publicView` value that applies to {@link origin}: null when it names none. */
function valueFor(publicView: PublicViewConfig | undefined, origin: string): boolean | null {
  if (typeof publicView === 'object' && publicView !== null) {
    return new Map(Object.entries(publicView)).get(origin) ?? null;
  }
  return publicView ?? null;
}

/**
 * How the build treats signed-out viewing of {@link origin}: `off` for an
 * instance it did not configure, whatever the setting; otherwise `force`,
 * `off` or `backend` per the setting, an unnamed origin in the object form
 * counting as null. For `same-origin` the caller passes `location.origin`.
 */
export function publicViewSetting(config: PublicViewInput, origin: string): PublicViewSetting {
  if (!isConfigured(config.instances, origin)) {
    return 'off';
  }
  const value = valueFor(config.publicView, origin);
  if (value === null) {
    return 'backend';
  }
  return value ? 'force' : 'off';
}
