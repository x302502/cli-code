# Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please).
Nothing is published by hand.

## How it works

1. Merge PRs into `main`. Their titles (or commit subjects) must be conventional commits in
   plain English: `feat: …` is a new feature, `fix: …` a bug fix, `perf:` / `docs:` also show up in
   the notes; `refactor:`, `test:`, `build:`, `ci:`, `style:` and `chore:` are left out of them.
   A breaking change is `feat!: …` (while the version is 0.x it bumps the minor number).
   Prefer **squash merge**: one commit is listed. In this repository GitHub gives it the PR title
   (or, for a PR with a single commit, that commit's subject) and the branch's commit messages as
   its body. With a plain merge commit, GitHub puts the PR title in the commit body, so a
   conventional title is listed in addition to every commit of the branch.
2. The bot keeps one **Release PR** ("chore: release X.Y.Z") up to date. It bumps the version in
   `package.json` and adds the new section to `CHANGELOG.md`; the PR description holds the same
   notes.
3. To change the notes, edit the **PR description** just before merging: that text becomes the
   GitHub Release body. `CHANGELOG.md` (the Marketplace Changelog tab, shipped in the package)
   is a separate copy; the bot rebuilds the Release PR branch whenever new commits land on
   `main`, so a hand edit of the file there can be overwritten.
4. Merge the Release PR. The bot tags `vX.Y.Z` and creates the GitHub Release. The same
   `release` workflow then runs `package.yml`, which builds all targets, verifies them, publishes
   them to the VS Code Marketplace and attaches the `.vsix` files to the release.

`package.yml` refuses to publish unless the tag, `package.json`, every `.vsix` and a non-empty
CHANGELOG section all name the same version.

## One-time setup

1. **Secret `VSCE_PAT`** (Settings → Secrets and variables → Actions): a personal access token
   from Azure DevOps with scope **Marketplace → Manage** and **All accessible organizations**,
   for the publisher `x302502`.
2. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create
   and approve pull requests** (read and write permissions are set per job in the workflows).

## Dry run

Actions → **package** → *Run workflow*, leave **publish** off. It builds every target, runs
`verify-vsix`, and checks the versions and the release notes, then stops before the Marketplace
and the GitHub Release. Run it on a branch, or on the `main` commit you are about to release.

## Notes

- The first Release PR covers only commits after `bootstrap-sha` in `release-please-config.json`
  (the commit `0.2.0` was published from); there is no `v0.2.0` tag, so the compare link in its
  CHANGELOG heading will not resolve. With the commits on `main` after it, the first release is
  0.2.1.
- Version numbers (a permanent policy, checked against release-please 17.6.0):

  | While the version is 0.x | Next version after 0.2.0 |
  | --- | --- |
  | `fix:`, `feat:`, `perf:`, `docs:` … | 0.2.1 |
  | breaking: `feat!: …` or a `BREAKING CHANGE:` footer | 0.3.0 |
  | a `Release-As: X.Y.Z` footer | exactly X.Y.Z |

  So releases are 0.2.1, 0.2.2, … and a "big change" is the only thing that moves the minor.
  The settings behind this are `bump-patch-for-minor-pre-major` and `bump-minor-pre-major`, both
  `true` in `release-please-config.json` (a test pins them).
- To ship a **big change** (minor bump): make sure the commit that lands on `main` has a `!` in
  its subject (`feat!: …`; for a squash merge, the PR title or the single commit's subject), or a
  `BREAKING CHANGE: …` line in its body (in one of the branch's commit messages, or typed into the
  merge box; a line only in the PR description is not read). Or, to name the number yourself, add a `Release-As: 0.3.0` footer to any commit on `main` (an
  empty one works: `git commit --allow-empty -m "chore: release 0.3.0" -m "Release-As: 0.3.0"`);
  the Release PR then proposes exactly that version.
- If the package job fails after the tag exists: **Re-run failed jobs** works; **Re-run all jobs**
  publishes nothing (the bot then sees no new release); or run **package** by hand on the tag with
  publish on.
- To reach **1.0.0**: use `Release-As: 1.0.0` (a breaking change in 0.x only reaches the next
  minor). From 1.0.0 on the usual rules apply: fix → patch, feat → minor, breaking → major.
- A tag pushed by hand (`git tag vX.Y.Z && git push --tags`) still runs `package.yml`, and creates
  the release from the CHANGELOG section if none exists. Tags made by the bot do not start it
  (GitHub does not run workflows for events made with `GITHUB_TOKEN`), which is why `release.yml`
  calls `package.yml` itself.
