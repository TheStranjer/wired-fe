#!/usr/bin/env bash
# scripts/check-file-sizes.sh — hard byte limits per file, on top of ESLint's
# line limits. A file over its limit must be split, not exempted. Prints every
# offender and exits 1 if there is any, 0 otherwise.

set -uo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || exit 1

offenders=0

# limit DIR BYTES PATTERN... — report files under DIR matching any PATTERN
# that are larger than BYTES.
limit() {
  local dir="$1" bytes="$2"
  shift 2
  [[ -d "$dir" ]] || return 0
  local names=()
  for pattern in "$@"; do
    names+=(-o -name "$pattern")
  done
  while IFS= read -r file; do
    printf '%s: %s bytes, limit %s\n' "$file" "$(wc -c <"$file")" "$bytes"
    offenders=$((offenders + 1))
  done < <(find "$dir" -type f \( "${names[@]:1}" \) -size +"${bytes}"c | sort)
}

limit src 8000 '*.ts' '*.tsx'
limit src 4000 '*.css'
limit tooling 8000 '*.ts' '*.js'
limit e2e 8000 '*.ts'
limit scripts 8000 '*.sh'
limit public 100000 '*'

if ((offenders > 0)); then
  printf '%d file(s) over their size limit\n' "$offenders"
  exit 1
fi
printf 'All files within their size limits.\n'
