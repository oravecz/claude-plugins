# claude-plugins

Personal Claude Code marketplace for PR workflows and TypeScript, Java, and
Dart language-server plugins, with a project installer for optional LSP and lat.md.

## Set up a project

Run from the project you want to configure:

```sh
cd /path/to/my-project
/path/to/claude-plugins/install.sh
```

The installer registers `oravecz/claude-plugins` in project-level settings and
updates all installed `@oravecz` plugins in this project's project/local scopes.
It then offers a language (`none` by default, TypeScript, Java, or Dart) and asks
for y/n confirmation before LSP setup and before lat.md installation/initialization.
Plugin refresh runs even when optional setup is skipped; existing enablement and
unselected external services are preserved. User-scope and other-project plugin
installation records are not updated.

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
