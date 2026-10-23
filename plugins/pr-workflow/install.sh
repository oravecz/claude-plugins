#!/usr/bin/env sh
# Run from the consumer project's root, not from this script's directory.
set -eu

step=preflight
trap 'status=$?; if [ "$status" -ne 0 ]; then printf "\nFailed during %s. Fix the error above and rerun install.sh.\n" "$step" >&2; fi' 0

if [ "$#" -ne 0 ]; then
  printf 'Usage: %s\nRun from the project to configure.\n' "$0" >&2
  exit 2
fi

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s. See the plugin README prerequisites.\n' "$1" >&2
    exit 1
  fi
}

confirm() {
  while :; do
    printf '%s [y/N]: ' "$1"
    IFS= read -r answer || return 1
    case "$answer" in
      y|Y|yes|YES) return 0 ;;
      n|N|no|NO|'') return 1 ;;
      *) printf 'Please enter y or n.\n' ;;
    esac
  done
}

set_plugin_state() {
  # Enablement overrides belong to settings, not the plugin's installation scope.
  # The CLI rejects project disable when a predecessor is installed only for user.
  node -e '
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const [id, action, project] = process.argv.slice(1);
const wanted = action === "enable";
const changes = [];
for (const [scope, file] of [["project", "settings.json"], ["local", "settings.local.json"]]) {
  const location = path.join(project, ".claude", file);
  const exists = fs.existsSync(location);
  const settings = exists ? JSON.parse(fs.readFileSync(location, "utf8")) : {};
  const current = settings.enabledPlugins?.[id];
  if (current === wanted || (scope === "local" && current === undefined)) continue;
  settings.enabledPlugins ||= {};
  settings.enabledPlugins[id] = wanted;
  changes.push({ location, settings, scope, mode: exists ? fs.statSync(location).mode & 0o777 : 0o600 });
}
for (const { location, settings, scope, mode } of changes) {
  const temporary = `${location}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { flag: "wx", mode });
    fs.renameSync(temporary, location);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  console.log(`${action}: ${id} (${scope} settings)`);
}
' "$1" "$2" "$project_dir"
}

install_plugin() {
  step="project plugin $1"
  plugins=$(claude plugin list --json)
  installed=$(printf '%s\n' "$plugins" | node -e '
const entries = JSON.parse(require("fs").readFileSync(0, "utf8"));
const [id, project] = process.argv.slice(1);
process.stdout.write(entries.some(p => p.id === id && p.scope === "project" &&
  p.projectPath === project) ? "yes" : "no");
' "$1" "$project_dir")
  # Existing project/local installations were refreshed before optional setup.
  if [ "$installed" = no ]; then
    claude plugin install "$1" --scope project
  fi
  set_plugin_state "$1" enable

  # Replace the older provider only in this project, not in user settings.
  if [ -n "$2" ]; then
    conflict=$(printf '%s\n' "$plugins" | node -e '
const entries = JSON.parse(require("fs").readFileSync(0, "utf8"));
const [id, project] = process.argv.slice(1);
process.stdout.write(entries.some(p => p.id === id &&
  (p.scope === "user" || p.projectPath === project)) ? "yes" : "no");
' "$2" "$project_dir")
    if [ "$conflict" = yes ]; then
      set_plugin_state "$2" disable
    fi
  fi
}

require claude
require git
require node
project_dir=$(pwd -P)
installer_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
printf 'Configuring project: %s\n' "$project_dir"

step='project marketplace registration and refresh'
# Repeating add is intentional: a cached/user marketplace is not a declaration
# in this project's settings. Claude merges the existing settings.
claude plugin marketplace add oravecz/claude-plugins --scope project
claude plugin marketplace update oravecz

step='current-project oravecz plugin updates'
plugins=$(claude plugin list --json)
updates=$(printf '%s\n' "$plugins" | node -e '
const entries = JSON.parse(require("fs").readFileSync(0, "utf8"));
const project = process.argv[1];
for (const plugin of entries) {
  if (plugin.id.endsWith("@oravecz") && plugin.projectPath === project &&
      (plugin.scope === "project" || plugin.scope === "local")) {
    console.log(`${plugin.scope}:${plugin.id}`);
  }
}
' "$project_dir")
# Scope/ID tokens have no whitespace; keep stdin available for CLI confirmations.
for target in $updates; do
  scope=${target%%:*}
  plugin=${target#*:}
  step="plugin update $plugin ($scope)"
  claude plugin update "$plugin" --scope "$scope"
done

printf '\nLSP language: 0) none  1) typescript  2) java  3) dart\n'
while :; do
  printf 'Language [none]: '
  IFS= read -r language || language=none
  case "$language" in
    ''|0|none) language=none; break ;;
    1|typescript) language=typescript; break ;;
    2|java) language=java; break ;;
    3|dart) language=dart; break ;;
    *) printf 'Choose none, typescript, java, or dart.\n' ;;
  esac
done

if [ "$language" != none ] && confirm "Install/update the $language LSP service and enable its plugin for this project?"; then
  step="$language LSP installation"
  case "$language" in
    typescript)
      require npm
      tools_dir="${XDG_DATA_HOME:-$HOME/.local/share}/oravecz/typescript-lsp"
      # Keep fallback tooling outside application dependencies and global tsc.
      npm install --prefix "$tools_dir" --no-save --package-lock=false --engine-strict \
        typescript-language-server@latest typescript@latest
      install_plugin typescript-lsp@oravecz typescript-lsp@claude-plugins-official
      ;;
    java)
      require tar
      require python3
      python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else "JDT LS requires Python 3.9 or newer")'
      node "$installer_dir/scripts/install-java.mjs"
      install_plugin java-lsp@oravecz jdtls-lsp@claude-plugins-official
      ;;
    dart)
      require unzip
      node "$installer_dir/scripts/install-dart.mjs"
      install_plugin dart-lsp@oravecz ''
      ;;
  esac
else
  printf 'Skipping LSP service setup; existing plugin enablement is unchanged.\n'
fi

printf '\n'
if confirm "Install/update lat.md and run its setup wizard in $project_dir?"; then
  step='lat.md installation and project initialization'
  if [ ! -t 0 ]; then
    printf 'Run this step in an interactive terminal so lat can configure Claude Code.\n' >&2
    exit 1
  fi
  require npm
  npm install --global --engine-strict lat.md@latest
  require lat
  printf '\nIn the lat wizard, select Claude Code and the global lat command.\n'
  lat init "$project_dir"
else
  printf 'Skipping lat.md installation and initialization.\n'
fi

printf '\nDone. Restart Claude Code or run /reload-plugins to apply plugin changes.\n'
