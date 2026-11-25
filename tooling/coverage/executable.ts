/**
 * Does a source file hold anything that runs? A changed file that is absent
 * from the coverage map fails the gate, unless it is only types and comments.
 */
import { stripTypeScriptTypes } from 'node:module';

/**
 * True when the file has code beyond type declarations, type-only imports and
 * exports, and comments. Source that cannot be stripped of its types (JSX,
 * enums, namespaces) counts as executable.
 */
export function hasExecutableCode(source: string): boolean {
  if (source.trim() === '') {
    return false;
  }
  let js: string;
  try {
    js = stripTypeScriptTypes(source, { mode: 'strip' });
  } catch {
    return true;
  }
  const code = js
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')
    .replace(/\bexport\s*\{\s*\}/gu, '');
  return /[^\s;]/u.test(code);
}
