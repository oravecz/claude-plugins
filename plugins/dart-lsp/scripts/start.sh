#!/usr/bin/env sh
set -eu
current="${XDG_DATA_HOME:-$HOME/.local/share}/oravecz/dart-lsp/current"
# Pin this process to the selected release before a later update switches current.
release=$(CDPATH= cd -P "$current" && pwd -P)
exec "$release/dart-sdk/bin/dart" language-server --protocol=lsp
