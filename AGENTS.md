# Repository Guidelines

## Project Overview

Personal Claude Code marketplace registered as `oravecz`, with `pr-workflow` skills and TypeScript, Java, and Dart LSP plugins. Workflows are agent-executed Markdown; a POSIX shell installer configures consumer projects and manages external services.

## Architecture & Data Flow

`.claude-plugin/marketplace.json` registers each `plugins/<name>` directory. Claude loads skill entry points from `SKILL.md` and language servers from each LSP plugin's `.lsp.json`.

Three skills separate policy from orchestration:

- `pr-workflow`: shared, numbered rules for commits, branches, testing, PRs, and state.
- `implement-issue`: reads a GitHub issue, checks preconditions, creates/resumes a worktree, delegates planning/TDD/execution to `superpowers`, runs the consumer project's gate, opens a PR, and waits for approval before squash-merging.
- `implement-epic`: processes GitHub sub-issues sequentially through `implement-issue`, overriding the base and merge policy. Passing sub-issue PRs are squash-merged automatically into the epic branch; the final epic PR requires human approval and a **merge commit**, not a squash.

GitHub issues, sub-issue ordering, comments, and PRs hold live project state; Git holds branches/worktrees. Keep live progress out of skill documents. `develop` means `origin/develop` when available, otherwise the repository's default branch; interpret examples accordingly.

The installer targets its current working directory: project marketplace registration, refresh of every installed `@oravecz` project/local plugin for that directory, optional confirmed language setup, then optional confirmed lat.md installation/initialization. TypeScript's Node resolver selects an installed project compiler (TS6 legacy server, TS7 native server) or managed latest fallback. Java/Dart use verified upstream archives and atomic current symlinks; launchers resolve immutable release paths before shell exec.

## Key Directories

- `.claude-plugin/`: marketplace registration, not plugin-local metadata.
- `plugins/pr-workflow/.claude-plugin/`: the installed plugin's identity/version metadata.
- `plugins/pr-workflow/skills/`: workflow implementation; each kebab-case skill directory contains `SKILL.md`. The sibling `install.sh` manages dependencies and ships with the plugin.
- `plugins/{typescript-lsp,java-lsp,dart-lsp}/`: LSP manifests, extension mappings, and runtime launchers. TypeScript's `scripts/resolve.mjs` is the compiler-selection logic.
- `plugins/pr-workflow/scripts/`: upstream Java/Dart installers and shared streaming download, checksum, and release-activation helpers.

## Development Commands

Run from the repository root:

```sh
claude --plugin-dir ./plugins/pr-workflow  # load locally for one session
claude plugin validate .                  # validate marketplace metadata
for plugin in plugins/*; do claude plugin validate "$plugin"; done
for script in install.sh plugins/*/install.sh plugins/*/scripts/*.sh; do sh -n "$script"; done
for script in plugins/pr-workflow/scripts/*.mjs plugins/typescript-lsp/scripts/*.mjs; do node --check "$script"; done
```

Run `/path/to/claude-plugins/install.sh` from a **consumer project root**, not here unless configuring this repository intentionally.

Installation commands belong **inside Claude Code**, not a shell:

```text
/plugin marketplace add oravecz/claude-plugins
/plugin install pr-workflow@oravecz
```

Workflow invocation examples: `implement issue 42`, `implement epic 164`. These mutate Git/GitHub state; do not use them as harmless validation commands.

No repository build, test, or lint scripts are defined. Root `install.sh` delegates to `plugins/pr-workflow/install.sh` without changing cwd. Services are shared per user; plugin configuration is project-scoped. Use isolated settings/tool directories for verification.

## Code Conventions & Common Patterns

- Treat skill prose, shell examples, and cross-references as code. Keep shared policy, both orchestration skills, and affected READMEs consistent. Preserve numbered `rule N`, step, and cleanup-item references when editing.
- Match existing formatting: YAML frontmatter with `name` matching the directory and folded `description: >-`; Markdown headings, ordered steps, fenced `sh` examples; two-space JSON indentation. No formatter is configured.
- Installer code is POSIX `sh` with fail-fast errors. Read plugin inventory as JSON and match marketplace suffix, scope, and projectPath. Refresh existing `@oravecz` project/local records before optional prompts without changing enablement. Language defaults to none; confirmations default to no. Skips preserve external services; confirmed selection alone installs missing plugins and reconciles current-project/local enablement.
- Preserve fail-fast behavior: preflight failures stop with a report, rather than silently repairing or skipping work. Resume existing issue worktrees/epic branches instead of duplicating them.
- Workflow execution uses ordered skill/CLI delegation and blocking `gh pr checks --watch`. Upstream installers use async/await for network/filesystem work and checked synchronous archive commands; there is no dependency-injection framework. Consumer instructions and `pr-workflow` override conflicting `superpowers` defaults.
- Keep LSP stdout protocol-only. Runtime selection must preserve application dependencies/global compiler versions. Resolve TypeScript package metadata before its bin path (TS7 exports hide bin subpaths). Do not substitute the Dart MCP plugin for native LSP.
- Plugin installation scope and settings override scope differ. Merge `enabledPlugins` atomically in project/local settings when replacing a user-installed provider; the CLI cannot disable that installation at project scope. Preserve unrelated keys, file permissions, and user settings.
- Distinguish remote worktree bases (`origin/<base>`) from PR bases (`<base>`); do not accidentally double-prefix `origin/`.
- The shipped commit convention is `type(scope): summary`: imperative, lowercase summary, no trailing period, with `Closes #123` or `Refs #123` in the footer. Epic sub-issue PRs use `Refs`, not `Closes`.
- Keep cleanup conditional on verified merges; unrelated worktrees and surviving remote branches require permission before deletion.

## Important Files

- `.claude-plugin/marketplace.json`: plugin registry; keep names and relative source paths aligned with plugin metadata.
- `plugins/pr-workflow/.claude-plugin/plugin.json`: plugin name, version, description, author, and license metadata.
- `README.md`: repository installer entry point and local development commands.
- `plugins/pr-workflow/README.md`: skill usage and consumer-project prerequisites.
- `plugins/pr-workflow/install.sh`: canonical installer; its README documents prerequisites, update cadence, and lat.md project setup.
- `plugins/pr-workflow/skills/pr-workflow/SKILL.md`: policy authority referenced by both implementation skills.

## Runtime/Tooling Preferences

Claude Code, Git, and Node are bootstrap prerequisites; Node parses inventory even when optional setup is skipped. TypeScript and lat.md use npm, with engine-strict checks (current TypeScript server needs Node >=22.22.2). Java uses tar/Python 3.9+; Dart uses unzip. Do not use system package managers or sudo. No repository package.json, lockfile, or Bun requirement exists.

Executing the workflows requires Git worktrees, authenticated GitHub CLI `gh`, and the `superpowers` plugin. Consumer projects must provide npm tooling: `npm ci` installs their dependencies and `npm run gate` runs their lint, build, and all test suites. These are **not commands supplied by this repository**; no `package.json` exists here.

Managed LSP tools live under `${XDG_DATA_HOME:-$HOME/.local/share}/oravecz/`; lat.md is a global npm CLI. Java uses an isolated latest Temurin LTS JDK regardless of project JAVA_HOME; Dart uses its downloaded SDK regardless of PATH/Flutter/FVM. Confirmed lat setup invokes its interactive wizard in the consumer project.

## Testing & QA

No automated test framework, fixtures, CI workflow, or coverage threshold is configured. Run both Claude validation commands after metadata changes; they do not prove workflow behavior. For skill changes, load the local plugin and check skill discovery, rule/step references, command placeholders, and approval boundaries without initiating a real issue workflow.

For installer changes, syntax-check shell/Node scripts and validate every plugin. Smoke-test project marketplace declaration and real version upgrades with optional steps skipped, including disabled plugins and local overrides; preserve user/other-project/other-marketplace records. Exercise confirmed setup and failures. Isolate HOME, CLAUDE_CONFIG_DIR, XDG_DATA_HOME, and npm prefix. Prove TypeScript selection with real TS6/TS7 projects and a no-local fallback; verify download integrity and that failed updates preserve the active release. Command doubles alone are not runtime proof.

Consumer-project behavior changes follow the skills' TDD policy. Their gate must fail on errors and must never be weakened to pass; shared rule 9 permits Markdown-only changes to skip that gate. Keep this consumer policy distinct from marketplace validation.
