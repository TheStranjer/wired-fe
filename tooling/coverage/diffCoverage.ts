/**
 * Entry point of the diff-coverage gate: `node tooling/coverage/diffCoverage.ts`
 * (`pnpm run diff-coverage`). Node strips the types itself, as it does for the
 * other tooling that `vite.config.ts` imports, so no build step is involved.
 * It needs `coverage/coverage-final.json` from the Vitest run with the
 * `json` coverage reporter, and exits 1 when anything is uncovered.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { runDiffCoverage } from './run.ts';

const ROOT = resolve(import.meta.dirname, '../..');

/** Git's stdout in the repository root, or undefined when git exits non-zero. */
function git(args: readonly string[]): string | undefined {
  try {
    return execFileSync('git', [...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1 << 30,
    });
  } catch {
    return undefined;
  }
}

try {
  const report = runDiffCoverage({
    env: process.env,
    git,
    root: ROOT,
    readText: (path) => readFileSync(resolve(ROOT, path), 'utf8'),
    sourceFiles: () =>
      readdirSync(resolve(ROOT, 'src'), { recursive: true })
        .map((path) => `src/${String(path)}`.replaceAll('\\', '/'))
        .filter((path) => /\.[cm]?[jt]sx?$/u.test(path)),
  });
  process.stdout.write(report.lines.map((line) => `${line}\n`).join(''));
  process.exitCode = report.passed ? 0 : 1;
} catch (error) {
  process.stderr.write(
    `diff coverage: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
