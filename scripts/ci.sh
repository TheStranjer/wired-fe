#!/usr/bin/env bash
# scripts/ci.sh — the whole gate in one command: dependency install check,
# Prettier, TypeScript, ESLint, Stylelint, file-size limits, unit tests with
# coverage thresholds, the production build, the bundle size report, dead-code
# detection (knip) and the end-to-end tests against the built bundle.
# .github/workflows/ci.yml runs this same script, so a clean run here is a
# green pipeline there.
#
# Every check runs even after another has failed, so one pass reports
# everything that is broken. The exception is the install: without the locked
# dependencies nothing else can run, so a failed install stops the gate.
#
# The exit status is explicit: 0 when every check passed, 1 otherwise.
#
# Usage:
#
#   scripts/ci.sh    # run the whole gate

set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(dirname -- "$script_dir")"
cd "$repo_root" || exit 1

# Make the pinned toolchain (mise.toml) findable from non-login shells, which
# never source the profile that activates mise.
if ! command -v pnpm >/dev/null 2>&1 && command -v mise >/dev/null 2>&1; then
  eval "$(mise env --shell bash)"
fi
if ! command -v pnpm >/dev/null 2>&1; then
  printf 'pnpm not found on PATH; install the toolchain pinned in mise.toml\n' >&2
  exit 1
fi

failed_checks=()

# step LABEL COMMAND... — print the label, stream the command's own output
# through untouched, and remember the label when the command fails.
step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  if ! "$@"; then
    failed_checks+=("$label")
    printf 'FAILED: %s\n' "$label" >&2
    return 1
  fi
}

# skip LABEL REASON — record a check that could not run as failed.
skip() {
  printf '\n==> %s\nFAILED: %s (skipped: %s)\n' "$1" "$1" "$2" >&2
  failed_checks+=("$1 (skipped: $2)")
}

if ! step 'install (frozen lockfile)' pnpm install --frozen-lockfile --prefer-offline; then
  printf '\nThe locked dependencies could not be installed; nothing else can run.\n' >&2
  exit 1
fi

step 'Prettier' pnpm exec prettier --check .
step 'TypeScript' pnpm exec tsc -b
step 'ESLint' pnpm exec eslint --max-warnings 0 .
step 'Stylelint' pnpm exec stylelint --max-warnings 0 'src/**/*.css'
step 'file sizes' scripts/check-file-sizes.sh
step 'unit tests + coverage' pnpm exec vitest run --coverage
step 'knip (unused files, exports, dependencies)' pnpm exec knip

if step 'build' pnpm exec vite build; then
  step 'bundle size report' pnpm exec size-limit
  step 'end-to-end tests' pnpm exec playwright test
else
  skip 'bundle size report' 'build failed'
  skip 'end-to-end tests' 'build failed'
fi

# Exit explicitly: green means 0, anything else means 1.
printf '\n'
if ((${#failed_checks[@]} == 0)); then
  printf 'All checks passed.\n'
  exit 0
fi

printf 'Failed checks:\n'
for check in "${failed_checks[@]}"; do
  printf '  - %s\n' "$check"
done
exit 1
