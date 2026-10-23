#!/usr/bin/env sh
set -eu
project_dir=${1:-"$PWD"}
selection=$(node "$(dirname -- "$0")/resolve.mjs" "$project_dir")
cd "$project_dir"
case "$selection" in
  native:*) exec node "${selection#native:}" --lsp --stdio ;;
  legacy:*) exec node "${selection#legacy:}" --stdio ;;
  *) printf 'Invalid TypeScript server selection.\n' >&2; exit 1 ;;
esac
