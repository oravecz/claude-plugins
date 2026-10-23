---
name: pr-workflow
description: >-
  The rules for moving work from a GitHub issue to the integration branch:
  conventional commits, issues and epics, worktrees, TDD, the local gate, PR
  flow for issues and epics, and human-gated merges. Load it when planning,
  branching, committing, opening or merging a pull request, or when the
  implement-issue and implement-epic skills cite a rule by number.
---

# PR Workflow

How work moves from an idea to the integration branch: issues, epics,
worktrees, the gate and pull requests. These rules bind every task in a
repository that uses this skill, including work done inside the
`implement-issue` and `implement-epic` skills.

**Integration branch.** Below, `develop` means the integration branch:
`develop` when `origin/develop` exists, otherwise the repository's default
branch (`gh repo view --json defaultBranchRef`).

Every change to the integration branch, `main` or `release/*` lands through a
reviewed pull request.

## 1. Conventional commits

Every commit message
follows [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): summary`, imperative mood, lower-case summary, no trailing period.
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`,
`perf`. Reference the issue in the footer (`Closes #123` or `Refs #123`).
Breaking changes use `!` after the type and a `BREAKING CHANGE:` footer.

## 2. Brainstorms become issues

All tasks and future features are tracked as GitHub issues. Any brainstorm,
planning session or bug analysis for a fix or a feature ends by creating a
GitHub issue with `gh issue create`. Do not leave the outcome only in chat.
Every open decision is asked in plain language and answered **before**
`gh issue create`, so an open issue is implementable by construction. The
issue body carries the problem, the settled decisions, and acceptance criteria
written as testable statements. An issue that waits on an outside decision
carries the `blocked` label; the skills refuse it until the label is removed.

## 3. Large work becomes an Epic with sub-issues

When the work is large or complex (more than one PR's worth), create one issue
whose title begins with `EPIC: ` describing the goal, then one sub-issue per
implementation task. No label is needed: an issue that contains sub-issues is an
epic. Each sub-issue must be independently implementable and independently
testable. Attach sub-issues to the epic:

```sh
gh issue create --title "EPIC: <goal>" --body "<goal, scope, done criteria>"
gh issue create --title "<task>" --body "Part of #<epic>. <acceptance criteria>"
# link: the REST endpoint needs the sub-issue's numeric database id, not its number
gh api "repos/{owner}/{repo}/issues/<epic>/sub_issues" \
  -F sub_issue_id="$(gh api repos/{owner}/{repo}/issues/<sub> --jq .id)"
```

## 4. Implementation entry points

Most development runs at the epic level with `implement epic ###` (skill
`implement-epic`), on an epic branch (rule 7). A single issue can be run with
`implement issue ###` (skill `implement-issue`), straight off `develop` (rule
8). Both skills apply rules 5 to 10 below.

## 5. TDD, red then green

For every behaviour change: write the failing test first (the suite must show it
red), then write the minimum code to make it pass (green), then refactor with
the suite still green. Do not write implementation before a failing test exists.
Tests live where the project keeps them, mirror the source layout by feature,
and run with the project's test commands.

## 6. Worktrees, always

All development happens on a git worktree, never on the checkout in the main
working directory. One worktree per issue, on a branch named
`<type>/<issue#>-<slug>` (e.g. `fix/140-measure-rounding`), created under the
gitignored `.worktrees/` from `origin/develop`, or from
`origin/epic/<epic#>-<slug>` for an epic's sub-issue:
`git worktree add .worktrees/<issue#>-<slug> -b <branch> origin/<base>`. Then
install dependencies in the worktree (`npm ci`); that also installs any git
hooks the project defines there.

## 7. Epic flow: an epic branch, auto-merged sub-issues, one human gate

When implementing an epic, first create its branch `epic/<epic#>-<slug>` from
`origin/develop` and name it in a comment on the epic. Then work through its
open sub-issues in order. For each sub-issue: worktree off the epic branch, TDD,
commit, confirm the gate passes (rule 9), open a PR against the **epic branch**
(body `Part of #<epic>`, `Refs #<sub>`), merge it automatically
(`gh pr merge --squash`), close the sub-issue with a comment naming the PR
(closing keywords fire only on the default branch), then remove the worktree
(rule 6). After the last sub-issue: merge any newer `develop` into the epic
branch through a PR (never a rebase), open one PR from the epic branch into
`develop` that says `Closes #<epic>`, wait for CI, run the gate on its head in a
fresh worktree, and stop and ask the human. Only on their approval: merge it
with a **merge commit** (`gh pr merge --merge`), so `develop` keeps one squash
commit per sub-issue; that also closes the epic. After it is created, an epic
branch changes only through pull requests; never push to it directly.

## 8. Issue flow: PR, then human gate

When implementing a single issue: worktree, TDD, commit, confirm the gate
passes, open a PR against `develop`, then stop and ask the human. Only on their
approval: merge the PR, remove the worktree, and close the issue. Do not merge
without that approval.

## 9. The gate

A PR opens only when `npm run gate` exits 0 in the worktree. Every project
defines that script; it runs the project's lint, build and every test suite,
stopping at the first failure. If the project has no `gate` script, stop and
ask for one. Fix lint errors with the project's lint fixer and commit the
result. A change confined to Markdown files may skip the gate. CI may run no
tests on pull requests, so this local gate is the only test gate. The gate is
an exit code, never a judgment call; never weaken it (scripts, lint rules,
skipped tests) to make a run pass.

## 10. Project state lives in GitHub, not in this skill

This skill holds rules only. Live state is read from GitHub when needed:

- **Build order:** the sub-issue order of the epic
  (`gh api repos/{owner}/{repo}/issues/<epic>/sub_issues`). A reordering is
  applied to that list and recorded as a comment on the epic.
- **What landed and why:** the merged PR's description and the issue's
  comments. Durable design facts go to the project's documentation.
