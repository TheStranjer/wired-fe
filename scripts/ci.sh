#!/usr/bin/env bash
# scripts/ci.sh — the whole gate in one command: dependency install check,
# Prettier, TypeScript, ESLint, Stylelint, file-size limits, unit tests with
# coverage thresholds, diff coverage (100% of the lines changed since master),
# the production build, the bundle size report, dead-code
# detection (knip) and the end-to-end tests against the built bundle.
# .github/workflows/ci.yml runs this same script, so a clean run here is a
# green pipeline there.
#
# Every check runs even after another has failed, so one pass reports
# everything that is broken. The exception is the install: without the locked
# dependencies nothing else can run, so a failed install stops the gate.
#
# The output is terse, so an LLM can read all of it: no news is good news.
# Each check's output is captured. A passing check prints nothing, unless its
# output has warning lines, which are printed alone. A failing check prints
# its whole output. Every tool runs with its most compact reporter, and colour
# codes, the repository path prefix, blank lines and rule lines are stripped.
# A fully green run prints nothing at all.
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

export NO_COLOR=1

log_dir="$(mktemp -d)"
trap 'rm -rf -- "$log_dir"' EXIT

# Lines of a passing check's output that are still worth reporting.
WARNING_PATTERN='(^|[^[:alpha:]])(warn|deprecat)|\(!\)'

failed_checks=()

# clean LOG — print LOG without colour codes, carriage returns, the absolute
# repository path, blank lines or lines drawn only from rule characters.
clean() {
  sed -E \
    -e 's/\x1b\[[0-9;?]*[[:alpha:]]//g' \
    -e 's/\r//g' \
    -e "s|${repo_root}/||g" \
    -e '/^[[:space:]⎯─━═-]*$/d' \
    "$1"
}

# step LABEL COMMAND... — run the command with its output captured. On
# success print only its warning lines, if any; on failure print all of its
# output and remember the label.
step() {
  local label="$1" log warnings
  shift
  log="$log_dir/${label//[^[:alnum:]]/-}.log"
  if "$@" >"$log" 2>&1; then
    warnings="$(clean "$log" | grep -iE "$WARNING_PATTERN")"
    if [[ -n "$warnings" ]]; then
      printf '== %s: warnings\n%s\n' "$label" "$warnings"
    fi
    return 0
  fi
  failed_checks+=("$label")
  printf '== %s: FAILED\n' "$label"
  clean "$log"
  return 1
}

# skip LABEL REASON — record a check that could not run as failed.
skip() {
  failed_checks+=("$1 (skipped: $2)")
}

if ! step 'install (frozen lockfile)' pnpm install --frozen-lockfile --prefer-offline; then
  printf 'Nothing else ran.\n'
  exit 1
fi

step 'Prettier (unformatted files)' pnpm exec prettier --list-different .
step 'TypeScript' pnpm exec tsc -b --pretty false
step 'ESLint' pnpm exec eslint --max-warnings 0 .
step 'Stylelint' pnpm exec stylelint --max-warnings 0 --formatter unix 'src/**/*.css'
step 'file sizes' scripts/check-file-sizes.sh
step 'unit tests + coverage' pnpm exec vitest run --reporter=dot --silent=passed-only \
  --coverage --coverage.reporter=text --coverage.reporter=json --coverage.skipFull
# Every statement, function and branch arm on a line changed since master must
# have run, and no coverage-ignore comment may exist. Needs the JSON just written.
step 'diff coverage' pnpm run --silent diff-coverage
step 'knip (unused files, exports, dependencies)' pnpm exec knip --reporter compact --no-progress

if step 'build' pnpm exec vite build; then
  step 'bundle size report' pnpm exec size-limit
  step 'end-to-end tests' pnpm exec playwright test --reporter=dot
else
  skip 'bundle size report' 'build failed'
  skip 'end-to-end tests' 'build failed'
fi

# Exit explicitly: green means 0, anything else means 1.
if ((${#failed_checks[@]} == 0)); then
  exit 0
fi

printf 'FAILED:'
printf ' [%s]' "${failed_checks[@]}"
printf '\n'
exit 1
