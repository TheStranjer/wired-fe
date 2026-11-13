/**
 * The build-time configuration schema (decision 3): which instances a build
 * may talk to and what the app calls itself. Loading and validating the config
 * file happens at build time; this module holds the valibot schema and the
 * parse function that produces a {@link WiredConfig} or a list of messages.
 */

import * as v from 'valibot';

import { type Result, err, ok } from '../lib/result';

/** The longest accepted {@link WiredConfig.appName}, after trimming. */
const MAX_APP_NAME_LENGTH = 64;

/** Hostnames allowed to use plain `http:` because they are the development machine. */
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

/** True when {@link value} is an `https:` origin, or `http:` on a local hostname. */
function isDevAllowedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && LOCAL_HOSTNAMES.includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

/** A scheme-and-host origin: `https://host[:port]`, or `http:` for localhost. */
const OriginSchema = v.pipe(
  v.string(),
  v.check(isDevAllowedOrigin, 'must be an https:// origin, or http:// for localhost'),
);

/** Which instances the build may talk to (decision 3). */
export type InstancesConfig =
  | { readonly mode: 'same-origin' }
  | { readonly mode: 'fixed'; readonly origin: string }
  | { readonly mode: 'list'; readonly origins: readonly string[] }
  | { readonly mode: 'open' };

/** The validated build-time configuration. */
export type WiredConfig = {
  readonly appName: string;
  readonly instances: InstancesConfig;
};

const InstancesSchema = v.variant('mode', [
  v.strictObject({ mode: v.literal('same-origin') }),
  v.strictObject({ mode: v.literal('fixed'), origin: OriginSchema }),
  v.strictObject({
    mode: v.literal('list'),
    origins: v.pipe(
      v.array(OriginSchema),
      v.minLength(1),
      v.check(
        (origins) => new Set(origins).size === origins.length,
        'must not contain duplicate origins',
      ),
    ),
  }),
  v.strictObject({ mode: v.literal('open') }),
]);

/** The schema for the build-time configuration file (decision 3). */
export const WiredConfigSchema: v.GenericSchema<unknown, WiredConfig> = v.strictObject({
  appName: v.pipe(
    v.string(),
    v.transform((value) => value.trim()),
    v.minLength(1),
    v.maxLength(MAX_APP_NAME_LENGTH),
  ),
  instances: InstancesSchema,
});

/** Formats one valibot issue as `"<dot.path>: <message>"`, `(root)` when unpathed. */
function describeIssue(issue: v.BaseIssue<unknown>): string {
  return `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`;
}

/**
 * Validates unknown input against {@link WiredConfigSchema}, returning the
 * trimmed configuration or every issue as one `"<dot.path>: <message>"` string.
 */
export function parseWiredConfig(input: unknown): Result<WiredConfig, readonly string[]> {
  const result = v.safeParse(WiredConfigSchema, input);
  return result.success ? ok(result.output) : err(result.issues.map(describeIssue));
}
