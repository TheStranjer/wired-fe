/**
 * The Istanbul `coverage-final.json` shape the diff-coverage gate reads, its
 * valibot schema, and the re-keying of its absolute file paths to
 * repository-relative ones.
 */
import { relative } from 'node:path';

import * as v from 'valibot';

/** A position; Istanbul leaves the line out (or null) for an arm that has no source. */
const PositionSchema = v.object({ line: v.nullish(v.number()) });

/** A source range. */
const LocSchema = v.object({ start: PositionSchema, end: v.optional(PositionSchema) });

const FileCoverageSchema = v.object({
  statementMap: v.record(v.string(), LocSchema),
  fnMap: v.record(
    v.string(),
    v.object({ name: v.string(), loc: v.optional(LocSchema), decl: v.optional(LocSchema) }),
  ),
  branchMap: v.record(v.string(), v.object({ locations: v.array(LocSchema) })),
  s: v.record(v.string(), v.number()),
  f: v.record(v.string(), v.number()),
  b: v.record(v.string(), v.array(v.number())),
});

/** One source range of the coverage map. */
export type Loc = v.InferOutput<typeof LocSchema>;

/** The coverage of one file: what exists (the maps) and how often it ran (s, f, b). */
export type FileCoverage = v.InferOutput<typeof FileCoverageSchema>;

/** Coverage per repository-relative path. */
export type CoverageMap = Readonly<Record<string, FileCoverage>>;

/**
 * Validates a parsed `coverage-final.json` and re-keys it by path relative to
 * `root`, with forward slashes. Throws when the shape is wrong.
 */
export function parseCoverageMap(json: unknown, root: string): CoverageMap {
  const absolute = v.parse(v.record(v.string(), FileCoverageSchema), json);
  const result: Record<string, FileCoverage> = {};
  for (const [path, coverage] of Object.entries(absolute)) {
    result[relative(root, path).replaceAll('\\', '/')] = coverage;
  }
  return result;
}
