# claude-plugins

Personal Claude Code marketplace for PR workflows and TypeScript, Java, and
Dart language-server plugins, with a project installer for workflow skills, LSP, and lat.md.

## Set up a project

Run from the project you want to configure:

```sh
cd /path/to/my-project
/path/to/claude-plugins/install.sh
```

The installer registers `oravecz/claude-plugins` in project-level settings and
updates all installed `@oravecz` plugins in this project's project/local scopes.
Claude Code keeps a shared marketplace clone outside the project; the installer
prints its actual cache location.

It then asks for y/n confirmation before installing/enabling `pr-workflow`,
before optional LSP setup (`none` by default, TypeScript, Java, or Dart), and
before lat.md installation/initialization. All confirmations default to no.
The workflow step reports whether `pr-workflow` is installed and where its files
are cached. Plugin refresh runs even when setup is skipped; skipping preserves
existing enablement and external services. User-scope and other-project plugin
installation records are not updated.

For Codex, run `install.sh --codex` instead. It installs only the `pr-workflow`
skills, user-wide, from the same marketplace and skips Claude Code, LSP, and
lat.md setup. See [Codex](plugins/pr-workflow/README.md#codex).

The root launcher delegates to
[`plugins/pr-workflow/install.sh`](plugins/pr-workflow/install.sh) without changing
the working directory. See its [README](plugins/pr-workflow/README.md#set-up-a-project)
for prerequisites, installation scope, update guidance, and verification.

TypeScript uses the installed project version (TS6 legacy LSP or TS7 native LSP),
falling back to the latest managed compiler when none is installed. It never
changes application dependencies or global `tsc`. Java and Dart use verified
upstream downloads in user-owned directories; no system package manager is used.

Publish the GitHub marketplace before running the installer; unpublished plugin
development can use the local loading command below.

## Develop a plugin here

```sh
claude --plugin-dir ./plugins/pr-workflow   # load for one session
claude plugin validate .                     # validate marketplace metadata
claude plugin validate ./plugins/pr-workflow  # validate plugin metadata
```

## Plugins

- `pr-workflow`: see `plugins/pr-workflow/README.md`.
- `typescript-lsp`: project-version-aware TS6/TS7 language-server selection.
- `java-lsp`: Eclipse JDT LS with an independent Temurin JDK.
- `dart-lsp`: native LSP from the official Dart SDK distribution.
