---
name: implement-issue
description: >-
  Implement one GitHub issue end to end: preflight, worktree off the
  integration branch (or the epic branch when implement-epic calls it), plan,
  TDD red/green, conventional commits, the gate, PR against the integration
  branch, a human gate before squash-merge, then cleanup (worktree, branch).
  Use when the user says "implement issue ###" or asks to build or fix one
  specific issue.
---

# Implement issue

Implements a single GitHub issue under the rules in the `pr-workflow` skill
(cited below as "rule N"). The issue number is the argument
(`implement issue 42`); below it is `<n>`.

**Base branch.** Run on its own, the base is `develop` (the integration
branch, as `pr-workflow` defines it): the worktree branches from
`origin/develop`, the PR targets `develop`, and step 6's human gate applies.
When `implement-epic` calls this skill it passes its epic branch as the base;
every `<base>` below is then `epic/<epic#>-<slug>`, and `implement-epic`
replaces steps 6 and 7 with its own merge and cleanup. Below, `<base>` is
`develop` unless a base was passed.

Where a superpowers skill's default conflicts with `pr-workflow` or the
project's own instructions (`CLAUDE.md`, `AGENTS.md`), those win.

## 0. Preflight — stop before doing anything else

Abort with a plain report if any check fails. Do not "fix and continue".

1. **Primary checkout.** `git rev-parse --git-common-dir` must print `.git`.
   This skill starts in the primary checkout, never inside a worktree.
2. **Issue is open.**
   `gh issue view <n> --json number,title,state,labels,body,comments`.
   Refuse if closed.
3. **Not an epic.** If
   `gh api "repos/{owner}/{repo}/issues/<n>/sub_issues" --jq length` is
   non-zero, stop and tell the user to use `implement epic <n>`.
4. **Not blocked.** If the labels include `blocked`, stop: it waits on an
   outside decision. If the body itself reads as unresolved (open (a)/(b)/(c)
   options, `TBD` acceptance criteria), report it as a **malformed issue**
   under rule 2; do not guess the decision.
5. **Clean tree.** `git status --porcelain` in the primary checkout must show no
   modified or staged files.

## 1. Worktree (rule 6)

If `git worktree list` already shows a worktree for issue `<n>`, resume in it
instead of creating a second: use its path and branch wherever the steps below
say `.worktrees/<n>-<slug>` and `<type>/<n>-<slug>`.

Pick `<type>` from the conventional-commit types (`fix` for a bug, `feat` for
new behaviour, …) and derive `<slug>` from the title: lowercase,
non-alphanumerics collapsed to `-`, trimmed, ≤ 40 chars.

```sh
git fetch origin
git worktree add .worktrees/<n>-<slug> -b <type>/<n>-<slug> origin/<base>
```

The base **must** be `origin/<base>`; if you use `superpowers:using-git-worktrees`
or a native worktree tool instead, verify with
`git merge-base --is-ancestor origin/<base> <type>/<n>-<slug>`.

Run `npm ci` in the worktree, then a baseline `npm run gate` (rule 9). A
baseline that is already red is reported, not worked around. All further work
happens in the worktree.

## 2. Plan

Invoke `superpowers:writing-plans` with the issue body (problem, settled
decisions, acceptance criteria) as the spec. Honour the project's conventions
in its `CLAUDE.md` or `AGENTS.md`.

## 3. Implement — TDD, red then green (rule 5)

Execute the plan with `superpowers:subagent-driven-development` (or
`superpowers:executing-plans`); every task follows
`superpowers:test-driven-development`:

1. **Red.** Write the failing test encoding the acceptance criterion, in the
   project's test layout. Run it with the project's test runner and confirm
   it fails for the right reason. Do not commit it yet if the project's
   pre-commit hook runs the suite: it would reject a red suite.
2. **Green.** Minimum implementation to pass; re-run. Commit the test and the
   implementation together as `fix(<scope>): …` / `feat(<scope>): …` with
   `Refs #<n>` in the footer.
3. **Refactor** with the suite green; commit as `refactor(<scope>): …`.

**Refactor issues: green, then green.** An issue that must keep behaviour (a
`refactor` issue, or a step its epic marks green/green) starts from a
characterization test that passes on the current code, not from a failing
one. Commit that test alone as `test(<scope>): …`; it passes, so a pre-commit
hook accepts it. Prove it can fail: break the code or its snapshot on purpose,
see it fail, undo. The refactor commit then changes no test and no snapshot. A
planned change of output goes in its own commit that updates the snapshot and
names the change.

Commit after every green step, one concern per commit, messages per rule 1.
Never `git commit --amend`, `--no-verify` or bare `git stash` in a worktree
sub-agents share.

Sub-agents cannot relax two rules: only the rule 9 gate clears the work, and an
implementation that contradicts the issue's settled decisions stops and asks
the user.

## 4. Document and gate (rule 9)

Update the project's documentation for every changed behaviour (commit as
`docs(<scope>): …`), then run `npm run gate` from the worktree. Never weaken
the gate (scripts, lint rules, skipped tests) to pass.

## 5. PR

Only after the gate passes:

```sh
git push -u origin <type>/<n>-<slug>
gh pr create --base <base> --title "<type>(<scope>): <summary>" --body "<body>"
```

The PR title is the squash commit's subject, so it must itself be a
conventional commit. The body must: say `Closes #<n>` (into `develop`) or
`Part of #<epic>` and `Refs #<n>` (into an epic branch, where closing keywords
do not fire); state **which acceptance criteria it satisfies** and how each was
demonstrated; record what review caught and any known limitation with the issue
filed for it. This body is the change's permanent record (rule 10).

Wait for CI: `gh pr checks <pr> --watch`. A red check is fixed at its cause.

## 6. Human gate (rule 8)

Stop. Report the PR URL, the gate result (test files and test count per
suite) and CI status, and ask the user, in plain language, whether to merge.
Do not merge on your own.

## 7. On approval only: merge and clean up

Run from the **primary checkout**; a worktree cannot remove itself.

1. **Merge:** `gh pr merge <pr> --squash`.
2. **Update develop:** `git checkout develop && git pull --ff-only origin
   develop`. A refused fast-forward → stop and report.
3. **Worktree:**

   ```sh
   git worktree remove --force .worktrees/<n>-<slug>
   git worktree prune
   ```

4. **Branch:** `git branch -D <type>/<n>-<slug>`. `-D` is required after a
   squash (the commits land under a new SHA) and is safe only because step 1
   verified the merge.
5. **Issue:** `gh issue view <n> --json state`; close it with a comment linking
   the PR if the PR did not.
6. **Stale check.** `git worktree list`, and
   `git ls-remote --heads origin <type>/<n>-<slug>` (never `git branch -a`,
   which lists refs deleted server-side). Report other worktrees and a
   surviving remote branch, and **ask** before removing any.

## Rules that must hold

- Preflight refusals are mechanical; never talk past a `blocked` label or a
  malformed issue.
- No implementation code before a failing test exists (for a refactor issue,
  a passing characterization test); every commit is a conventional commit.
- One worktree per issue, based on `origin/<base>` (`origin/develop` unless
  `implement-epic` passed its epic branch); never implement in the primary
  checkout.
- The PR opens only on a passing gate; never merge without the user's explicit
  approval.
