/**
 * The build-time configuration schema (decision 3): which instances a build
 * may talk to and what the app calls itself. Loading and validating the config
 * file happens at build time; this module holds the valibot schema and the
 * parse function that produces a {@link WiredConfig} or a list of messages.
 */

import * as v from 'valibot';

import { isAllowedInstanceUrl } from '../lib/origin';
import { type Result, err, ok } from '../lib/result';

/** The longest accepted {@link WiredConfig.appName}, after trimming. */
const MAX_APP_NAME_LENGTH = 64;

/** True when {@link value} is an `https:` origin, or `http:` on a local hostname. */
function isDevAllowedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && isAllowedInstanceUrl(url);
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
  | {
      readonly mode: 'list';
      readonly origins: readonly string[];
      /** Also accept any valid typed instance; `false` when absent. An empty list needs this. */
      readonly allowCustom?: boolean | undefined;
    }
  | { readonly mode: 'open' };

/** The validated build-time configuration. */
export type WiredConfig = {
  readonly appName: string;
  readonly instances: InstancesConfig;
  /**
   * The path the bundle is served under, `/` when absent: `/fe/` for a page at
   * `https://host/fe/`. Starts and ends with `/`. `pathToHash` strips it from
   * the redirect paths wired-be sends (its `FRONTEND_BASE_URL` path).
   */
  readonly basePath?: string | undefined;
  /**
   * The language shown when the reader has not chosen one, ahead of the
   * browser's (decision 19): a BCP 47 code. The build fails unless it is one
   * of the supported languages.
   */
  readonly defaultLocale?: string | undefined;
};

/** A path that starts and ends with `/`, with no empty, query or fragment parts. */
const BasePathSchema = v.pipe(
  v.string(),
  v.regex(/^\/(?:[^/?#\s\\]+\/)*$/u, 'must start and end with "/", e.g. "/fe/"'),
);

/** A BCP 47-style code: a 2-3 letter language, then `-` subtags such as `Hans` or `AT`. */
const LocaleCodeSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u, 'must be a language code such as "de"'),
);

/** Shown when a `list` has no origins and does not let the user type their own. */
const EMPTY_LIST_MESSAGE = 'an empty origins list needs allowCustom: true';

/** What {@link InstancesVariants} parses into, before the cross-field check. */
type ParsedInstances = v.InferOutput<typeof InstancesVariants>;

/** True unless {@link instances} is a `list` with no origins and no `allowCustom`. */
function listHasInstances(instances: ParsedInstances): boolean {
  return instances.mode !== 'list' || instances.origins.length > 0 || instances.allowCustom;
}

const InstancesVariants = v.variant('mode', [
  v.strictObject({ mode: v.literal('same-origin') }),
  v.strictObject({ mode: v.literal('fixed'), origin: OriginSchema }),
  v.strictObject({
    mode: v.literal('list'),
    origins: v.pipe(
      v.array(OriginSchema),
      v.check(
        (origins) => new Set(origins).size === origins.length,
        'must not contain duplicate origins',
      ),
    ),
    allowCustom: v.optional(v.boolean(), false),
  }),
  v.strictObject({ mode: v.literal('open') }),
]);

const InstancesSchema = v.pipe(InstancesVariants, v.check(listHasInstances, EMPTY_LIST_MESSAGE));

/** The schema for the build-time configuration file (decision 3). */
export const WiredConfigSchema: v.GenericSchema<unknown, WiredConfig> = v.strictObject({
  appName: v.pipe(
    v.string(),
    v.transform((value) => value.trim()),
    v.minLength(1),
    v.maxLength(MAX_APP_NAME_LENGTH),
  ),
  instances: InstancesSchema,
  basePath: v.optional(BasePathSchema),
  defaultLocale: v.optional(LocaleCodeSchema),
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
