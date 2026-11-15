/**
 * Loader for the window kind definitions. Each kind lives in its own feature
 * folder `src/features/<name>/windowKind.tsx` and self-registers by exporting
 * `windowKind`; the glob in loadWindowKinds collects them at build time, so
 * adding a kind never edits a shared list. knip cannot follow the glob, so
 * knip.json lists the feature files as entry files. The collector mirrors
 * src/commands/definitions.ts next door, but indexes by kind.
 */

import { type Result, err, ok } from '../lib/result';
import type { WindowKindDefinition } from '../state/windowKind';
import type { WindowKind } from '../windows/model';

/** Whether a value is a string-keyed object, e.g. a module namespace. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether a value is a window kind definition: an object with a string `kind`
 * and a function `Component` (AGENTS.md: function components only). `topic`
 * and `onPost` are the definition file's own business; the app layer renders
 * with them and TypeScript has already checked the file.
 */
function isDefinition(value: unknown): value is WindowKindDefinition {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['kind'] === 'string' && typeof value['Component'] === 'function';
}

/** The `windowKind` export of a globbed module, when it has the definition shape. */
function definitionOf(module: unknown): WindowKindDefinition | undefined {
  if (!isRecord(module)) {
    return undefined;
  }
  const definition = module['windowKind'];
  return isDefinition(definition) ? definition : undefined;
}

/**
 * Collect the `windowKind` export of every module into one map keyed by kind,
 * in path order. A module without a usable export is a programming error:
 * returns err naming the path. So is a kind two modules both claim. No
 * modules at all — no features built yet — is an empty map.
 */
export function collectWindowKinds(
  modules: Readonly<Record<string, unknown>>,
): Result<ReadonlyMap<WindowKind, WindowKindDefinition>, string> {
  const kinds = new Map<WindowKind, WindowKindDefinition>();
  const owners = new Map<WindowKind, string>();
  for (const path of Object.keys(modules).sort((a, b) => a.localeCompare(b))) {
    const definition = definitionOf(modules[path]);
    if (definition === undefined) {
      return err(`${path} does not export a windowKind`);
    }
    const owner = owners.get(definition.kind);
    if (owner !== undefined) {
      return err(`window kind ${definition.kind} is exported by ${owner} and ${path}`);
    }
    owners.set(definition.kind, path);
    kinds.set(definition.kind, definition);
  }
  return ok(kinds);
}

/**
 * The window kinds in `src/features`. Test files are excluded by the pattern
 * itself: only `windowKind.tsx` matches, and it must export the definition.
 */
export function loadWindowKinds(): Result<ReadonlyMap<WindowKind, WindowKindDefinition>, string> {
  const modules = import.meta.glob(['../features/*/windowKind.tsx'], { eager: true });
  return collectWindowKinds(modules);
}
