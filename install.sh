#!/usr/bin/env sh
# Keep the repository entry point and the distributed plugin on one installer.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$script_dir/plugins/pr-workflow/install.sh" "$@"
