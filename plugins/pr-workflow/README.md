# pr-workflow

Three skills that move work from a GitHub issue to the integration branch.

Install only this plugin inside Claude Code:

```text
/plugin marketplace add oravecz/claude-plugins
/plugin install pr-workflow@oravecz
```

- `pr-workflow`: the rules (conventional commits, issues and epics, worktrees,
  TDD, the gate, PR flow). The other two skills apply them.
- `implement-issue`: `implement issue ###`, one issue end to end.
- `implement-epic`: `implement epic ###`, an epic on an epic branch.

## What a project must provide

- A `gate` npm script (`npm run gate`) that runs the project's lint, build
  and every test suite, exiting non-zero at the first failure.
- `gh` authenticated for the repository.
- The `superpowers` plugin, which `implement-issue` uses for planning, TDD
  and execution.

The integration branch is `develop` when `origin/develop` exists, otherwise
the repository's default branch.

## Set up a project

Run the installer **from the project root you want to configure**, using its
absolute path. The repository-root launcher preserves your current directory:

```sh
cd /path/to/my-project
/path/to/claude-plugins/install.sh
# Or: /path/to/claude-plugins/plugins/pr-workflow/install.sh
```

The installer:

1. Adds `oravecz/claude-plugins` to this project's `.claude/settings.json` and
   refreshes its marketplace catalog, even if already registered at user scope.
   It then updates **every installed `@oravecz` plugin** in this project's
   project/local scopes, including `pr-workflow` and disabled plugins.
   Enablement is preserved; plugins that are not installed are not added.
2. Offers `none` (default), `typescript`, `java`, or `dart`. A separate **y/n**
   confirmation precedes installing/updating the selected service and enabling
   its plugin at **project scope**. Enter or `n` skips the step.
3. Asks **y/n** before installing/updating `lat.md` and running `lat init` in
   this project. Select **Claude Code** and the global **lat** command in its
   interactive wizard.

Every run refreshes installed marketplace plugins, even when both optional steps
are skipped. Confirm a capability to also install/update its external service or
initialize lat.md. Skipping leaves service installations and plugin enablement
unchanged; `none` does not uninstall an existing LSP.
Both confirmations default to **no**. Invalid responses are reprompted. lat
setup requires a terminal, not piped input, because its wizard selects agents.

The GitHub marketplace must be published before running this installer. It
does not silently replace the requested GitHub source with a local directory.
For unpublished plugin development, load a plugin with `claude --plugin-dir`.

### Prerequisites and scope

- Current Claude Code CLI, Git, and a current Node.js LTS are bootstrap
  prerequisites, even when skipping optional setup. Node parses plugin inventory.
  Network access is needed to GitHub and, for selected services, npm, Eclipse,
  Adoptium, or the Dart archive.
- npm is required for TypeScript and lat.md. Current `typescript-language-server`
  requires Node **>=22.22.2**. npm engine checks reject runtimes unsupported by
  future releases.
- `tar` and Python **3.9+** for Java; `unzip` for Dart. Java/Dart archives support
  macOS and Linux on arm64/x64. No system package manager or `sudo` is used.
- A writable npm global prefix with its `bin` directory on `PATH` for `lat`.
  Keep `node`, `python3` (Java), and `lat` available when starting Claude.

Project settings are merged, not replaced. Automatic plugin updates are limited
to `@oravecz` project/local installation records whose project path matches the
current directory. Other marketplaces, user-scope installations, and other
projects' installations/settings are unchanged. Claude's download cache and the
service binaries are shared per user; updating a service also affects other
projects using that managed runtime.
Confirmed plugin selection also reconciles conflicting keys in this project's
`settings.local.json`; unrelated local settings remain intact.

This bootstrap does **not** automatically install the workflow skills or
`superpowers`. To use them, install separately from the consumer project:

```sh
claude plugin marketplace add obra/superpowers-marketplace --scope project
claude plugin install superpowers@superpowers-marketplace --scope project
claude plugin install pr-workflow@oravecz --scope project
```

### Language services

| Choice | Service and plugin | Update behavior |
| --- | --- | --- |
| TypeScript | `typescript-lsp@oravecz`; latest `typescript-language-server` and fallback `typescript` in `${XDG_DATA_HOME:-$HOME/.local/share}/oravecz/typescript-lsp` | npm `@latest`; never modifies project dependencies or global `tsc` |
| Java | `java-lsp@oravecz`; latest Eclipse JDT LS milestone plus latest Temurin LTS JDK | Resolve upstream release metadata, verify SHA-256, activate complete release |
| Dart | `dart-lsp@oravecz`; latest stable SDK from the official Dart archive | Resolve stable version, verify SHA-256, activate complete release |

**TypeScript matches the installed project compiler.** Normal Node resolution
finds the project's `typescript/package.json`, including ancestor-hoisted npm
and pnpm installations. TypeScript 6 uses the latest legacy language server,
which loads the workspace's `tsserver`. TypeScript 7 launches that package's
native `tsc --lsp --stdio`. With no resolvable project compiler, the managed latest
TypeScript is used instead. Install your project's dependencies first to match
its pinned version. In mixed-version monorepos, launch Claude from the package
root; one LSP process cannot switch between TS6 and TS7 for individual files.

The old language server cannot run against TS7's removed `tsserver.js`; see
[its upstream installation requirements](https://github.com/typescript-language-server/typescript-language-server#installing).
The installer replaces an installed official TypeScript LSP provider only in the
current project's enablement settings, avoiding two servers for the same files.
With TypeScript 7.0.2, the native server can report `context canceled` and exit 1
after a successful LSP shutdown; this is upstream behavior, not an installation
failure. Verify initialization and diagnostics rather than shutdown status alone.

**Java** downloads [Eclipse JDT LS](https://download.eclipse.org/jdtls/milestones/)
and a matching-platform [Temurin LTS JDK](https://adoptium.net/temurin/releases/).
The server JDK is independent of the project's `JAVA_HOME` and Maven/Gradle target.
Its runtime requirements can be newer than the application's target: the current
JDT LS distribution needs Java 25 for bundled components despite an older minimum
in its launcher. The installer follows the latest Temurin LTS rather than relying
on a system JDK. An installed official `jdtls-lsp` provider is disabled only for
this project when selecting this one.
Observed with JDT LS 1.63.0: rapid shutdown during diagnostics on a reused
workspace can raise a `PreferenceManager` null error and stall process exit.
This also occurs when launching upstream directly; the wrapper does not patch
or suppress it. Initialization and Java diagnostics were verified separately.

**Dart** downloads the latest stable [official SDK](https://dart.dev/get-dart/archive).
The launcher uses that explicit path, so an older Flutter/FVM `dart` earlier on
`PATH` cannot mask the update. It does not upgrade Flutter, change a pinned SDK,
or run `pub upgrade`. This is native
[Dart LSP](https://github.com/dart-lang/sdk/blob/main/pkg/analysis_server/tool/lsp_spec/README.md),
not the separate Dart/Flutter MCP plugin.

Java/Dart live under `${XDG_DATA_HOME:-$HOME/.local/share}/oravecz/{java-lsp,dart-lsp}`.
Each run checks current upstream metadata. Complete matching releases are reused;
new archives are downloaded, checksum-verified, and extracted before switching the
`current` symlink. Failures leave the previous active release intact. Old releases
are retained for running sessions; remove retired `releases/` directories only
after stopping sessions that use them, never the target of `current`.

## lat.md initialization and updates

After confirmation, the installer runs `npm install --global --engine-strict
lat.md@latest`, then the upstream `lat init` wizard in the current project.
Selecting Claude Code creates `lat.md/`, installs its `lat-md` skill, adds a
managed instruction block to `AGENTS.md`, synchronizes prompt/stop hooks in
`.claude/settings.json`, and registers `lat mcp` in `.mcp.json`.

The wizard also changes ignore rules, including ignoring `.claude/` and
`.mcp.json`; review them if you intend to commit project plugin settings.
Existing custom instructions/configuration should be preserved; review prompts
before replacing locally edited generated blocks. Reinitialization updates the
integration rather than recreating your knowledge graph.

Run `lat check` afterward. Semantic search is offline by default: **no API key
is required**. Hosted embeddings are optional; never commit credentials.
See the [lat.md setup guide](https://github.com/vercel-labs/lat.md/blob/main/lat.md/quick-start.md).

## When to update and verify

- Rerun the installer to refresh installed `@oravecz` plugins after marketplace
  releases. No language or lat.md selection is needed for plugin updates.
- After language-server releases or changes to your project's TypeScript major
  version, select and confirm that capability to update its external tools too.
- After lat.md releases, confirm its step again to update both the CLI and
  project integration. Run `lat check` and review generated-file changes.
- Restart Claude Code or run `/reload-plugins`. Check `claude plugin list --json`
  for the current project's plugin, then exercise diagnostics in a throwaway
  source file. `/plugin` → **Errors** reports server startup problems.
- A failed step stops with a nonzero exit and names the stage. Earlier successful
  changes remain; fix the cause and rerun. No application dependencies are
  upgraded, and no issue/merge workflows are run.

When publishing plugin changes, bump that plugin's `.claude-plugin/plugin.json`
version so remote installations detect the update.
