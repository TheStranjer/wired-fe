/**
 * The build-time configuration schema (decision 3): which instances a build
 * may talk to and what the app calls itself. Loading and validating the config
 * file happens at build time; this module holds the valibot schema and the
 * parse function that produces a {@link WiredConfig} or a list of messages.
 */

import * as v from 'valibot';

import { type InstancesConfig, OriginSchema } from './instances';
import { type PublicViewConfig, PublicViewSchema, publicViewProblems } from './publicView';
import { type Result, err, ok } from '../lib/result';

export type { InstancesConfig } from './instances';

/** The longest accepted {@link WiredConfig.appName}, after trimming. */
const MAX_APP_NAME_LENGTH = 64;

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
  /**
   * Whether signed-out visitors may read an instance (decision 3): `true`
   * forces it on, `false` off, `null` or absent leaves it to the backend's
   * published policy, an object sets each origin. See `publicViewSetting`.
   */
  readonly publicView?: PublicViewConfig | undefined;
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
export const WiredConfigSchema: v.GenericSchema<unknown, WiredConfig> = v.pipe(
  v.strictObject({
    appName: v.pipe(
      v.string(),
      v.transform((value) => value.trim()),
      v.minLength(1),
      v.maxLength(MAX_APP_NAME_LENGTH),
    ),
    instances: InstancesSchema,
    basePath: v.optional(BasePathSchema),
    defaultLocale: v.optional(LocaleCodeSchema),
    publicView: v.optional(PublicViewSchema),
  }),
  v.forward(
    v.check(
      (config) => publicViewProblems(config).length === 0,
      (issue) => publicViewProblems(issue.input).join('; '),
    ),
    ['publicView'],
  ),
);

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
