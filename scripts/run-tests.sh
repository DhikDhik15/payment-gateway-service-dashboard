#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/pay-gate-dashboard-tests.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

mapfile -t test_files < <(find "$root/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) | sort)
if ((${#test_files[@]} == 0)); then
  echo "No frontend tests found."
  exit 0
fi

bundled=()
for file in "${test_files[@]}"; do
  name="$(basename "${file%.*}")-$(printf '%s' "$file" | cksum | cut -d' ' -f1).mjs"
  output="$tmp_dir/$name"
  "$root/node_modules/.bin/esbuild" "$file" \
    --bundle \
    --jsx=automatic \
    --platform=node \
    --format=esm \
    --target=node20 \
    --alias:@="$root/src" \
    --outfile="$output" \
    --log-level=error
  bundled+=("$output")
done

node --test "${bundled[@]}"
