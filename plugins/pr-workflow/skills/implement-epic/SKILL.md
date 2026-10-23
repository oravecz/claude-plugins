---
name: implement-epic
description: >-
  Implement a GitHub epic on an `epic/<epic#>-<slug>` integration branch:
  each sub-issue, in listed order, goes through the implement-issue skill with
  a PR into the epic branch, squash-merged once the gate passes; then one PR
  lands the epic on the integration branch with a merge commit after CI and
  the user's approval. Use when the user says "implement epic ###".
---

# Implement epic

Implements every open sub-issue of an epic under `pr-workflow` rule 7
(`develop` below is the integration branch as `pr-workflow` defines it). The
epic number is the argument (`implement epic 164`); below it is `<epic>`.

Sub-issues merge into an **epic branch**, not `develop`. The user's approval of
the epic's own pull request into `develop` is the run's only human gate.

## Steps

1. **Read the epic.**
   `gh issue view <epic> --json title,body,labels,state,comments`. An issue
   with sub-issues is an epic (titled `EPIC: …`). If it has none, stop and tell
   the user to break it down first (rule 3).
2. **Order = the sub-issue list** (rule 10). GitHub returns sub-issues in their
   listed order, which is the user's build order:

   ```sh
   gh api "repos/{owner}/{repo}/issues/<epic>/sub_issues" --jq '.[] | select(.state=="open") | "\(.number) \(.title)"'
   ```

   Work them top to bottom. If the epic's comments record a reorder the list
   does not reflect, stop and ask.
3. **Epic branch.** Derive `<slug>` from the epic title without its `EPIC: `
   prefix: lowercase, non-alphanumerics collapsed to `-`, trimmed, ≤ 40 chars.
   Below, `<epic-branch>` is `epic/<epic>-<slug>`.
   - If `git ls-remote --heads origin "refs/heads/epic/<epic>-*"` already
     lists one, resume on it; never create a second.
   - Otherwise create it from `origin/develop` and record it on the epic:

     ```sh
     git fetch origin
     git push origin origin/develop:refs/heads/<epic-branch>
     gh issue comment <epic> --body "Epic branch: \`<epic-branch>\` (from develop at <sha>)."
     ```

   The branch is pull-request-only: never push to it directly after creating
   it.
4. **For each open sub-issue, in order:**
   1. Follow `implement-issue` steps 0–5 exactly **with base
      `origin/<epic-branch>`**: the worktree is created from it, the ancestry
      check uses it, and the PR is opened with `--base <epic-branch>`. The PR
      body says `Part of #<epic>` and `Refs #<sub>` — **not** `Closes`,
      because closing keywords fire only on a merge into the default branch. A
      preflight refusal — `blocked` label, malformed issue — **stops the whole
      run**; never skip a sub-issue silently.
   2. **Merge automatically** once the gate passed and any CI checks on the PR
      are green: `gh pr merge <pr> --squash`. No human gate at this level.
   3. **Close the sub-issue yourself:**
      `gh issue close <sub> --comment "Merged into <epic-branch> by #<pr> (<squash sha>)."`
   4. Clean up from the primary checkout: `git fetch origin`, then
      `implement-issue` step 7 items 3, 4 and 6 (worktree, branch, stale
      check). Local `develop` does not move during an epic.
   5. Report one line: sub-issue number, PR URL, squash commit.
   6. Stop the run and ask the user, in plain language, if the gate cannot be
      made green after two attempts, a sub-issue's acceptance criteria are
      unclear, or implementation contradicts the issue's settled decisions.
5. **Bring the epic branch up to date.** If
   `git merge-base --is-ancestor origin/develop origin/<epic-branch>` fails,
   `develop` moved during the epic. Merge it in through a pull request, never a
   rebase:

   ```sh
   gh pr create --base <epic-branch> --head develop \
     --title "chore(epic): merge develop into <epic-branch>" --body "Part of #<epic>."
   gh pr checks <pr> --watch
   gh pr merge <pr> --merge
   ```

   A conflict is resolved on a worktree branch off `origin/<epic-branch>` that
   merges `origin/develop`, through its own PR into the epic branch.
6. **Open the epic PR.**
   `gh pr create --base develop --head <epic-branch> --title "<type>(<scope>): <epic summary>"`.
   The title is a conventional commit. The body maps each of the epic's done
   criteria to the sub-issue PR and test that met it, lists every sub-issue PR,
   and says `Closes #<epic>`. Wait for CI: `gh pr checks <pr> --watch`.
7. **Gate on the epic head**, in a fresh worktree:

   ```sh
   git worktree add --detach .worktrees/<epic>-land origin/<epic-branch>
   # in it: npm ci, then
   npm run gate
   ```

   Remove that worktree afterwards (`git worktree remove --force`, then
   `git worktree prune`).
8. **Human gate.** Report the epic PR URL, the CI result, and the gate result
   (test files and test count per suite). Ask the user, in plain language,
   whether to land the epic. Never merge it on your own.
9. **On approval only:**

   ```sh
   gh pr merge <pr> --merge --subject "<the PR title> (#<pr>)"
   git checkout develop && git pull --ff-only origin develop
   ```

   A merge commit, never a squash, so `develop` keeps one squash commit per
   sub-issue. Then close the epic with a comment that links the PR and ends
   with the **What you should know** section below; if a closing keyword
   already closed it, post the comment anyway. If
   `git ls-remote --heads origin <epic-branch>` still lists the epic branch,
   report it and ask before deleting it.

## What you should know

The epic's closing comment and the run's final report end with the same
section, headed `What you should know`. It lists, one or two lines each:

- fixes and behaviour changes the run made beyond what the sub-issues asked;
- problems found but not fixed (code or data), with counts and any issue
  filed for them;
- steps people must take now (setup, reseeds, rebuilds, migrations);
- changes made outside the pull requests (branches, checkouts, data);
- what was not checked, and the risks that remain.

## Rules that must hold

- Every sub-issue goes through `implement-issue`'s preflight, TDD and gate.
- One worktree per sub-issue, based on `origin/<epic-branch>`, removed after
  merge. Never implement in the primary checkout.
- Sub-issue PRs target the epic branch and merge automatically only on a
  passing gate. No sub-issue PR targets `develop`.
- The epic lands on `develop` through one PR, with a merge commit, only after
  CI, a gate on its head, and the user's explicit approval.
