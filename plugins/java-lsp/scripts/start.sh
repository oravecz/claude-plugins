#!/usr/bin/env sh
set -eu
data=${XDG_DATA_HOME:-$HOME/.local/share}/oravecz
# Pin this process to its release even when an update switches current.
release=$(CDPATH= cd -- "$data/java-lsp/current" && pwd -P)
# The server JDK is independent of the application's JAVA_HOME/target version.
exec python3 "$release/jdtls/bin/jdtls" --java-executable "$release/jdk/bin/java" "$@"
