# AxeAI Downstream Development

AxeAI is a downstream product built from `get-bb/bb`. Its development flow must let AxeAI ship product work without waiting for upstream pull requests while still making upstream updates routine and recoverable.

## Branch roles

| Ref                     | Role                                              | Allowed changes                                            |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `upstream/main`         | Read-only view of `get-bb/bb`                     | Fetch only                                                 |
| `main`                  | Stable AxeAI release line                         | Promotion of an already verified integration commit        |
| `axeai/integration`     | Current AxeAI product plus accepted upstream work | Upstream merge commits and completed AxeAI feature commits |
| `codex/<feature>`       | One bounded feature or fix                        | Work based on the last verified integration commit         |
| `codex/upstream-<date>` | One upstream synchronization attempt              | Conflict resolution and sync-only verification             |

`main` is not a development branch. `axeai/integration` is not a release until its exact commit has passed the promotion checks.

## Adding an upstream pull request before upstream accepts it

1. Fetch the pull request commit without changing any stable branch.
2. Create a bounded integration branch from `axeai/integration`.
3. Cherry-pick the pull request commit, preserving its commit identity in the message and changing only conflicts caused by AxeAI adaptations.
4. Run the tests for every touched package.
5. Merge the bounded branch into `axeai/integration` after verification.
6. When upstream later accepts an equivalent commit, inspect the patch before the next upstream sync. Drop the duplicate only when Git does not already recognize it as applied.

The upstream maintainer's review controls whether the change lands in upstream. It does not control whether AxeAI can carry and ship the change safely.

## Synchronizing upstream

1. Fetch `origin` and `upstream`, then record the SHAs of `main`, `axeai/integration`, and `upstream/main` in the task or pull request.
2. Create `codex/upstream-<date>` from the last verified `axeai/integration` commit.
3. Preview the merge and identify conflict clusters before starting it.
4. Merge `upstream/main` with a merge commit. Never rebase published AxeAI history onto upstream.
5. Resolve each conflict according to ownership:
   - Upstream core behavior follows upstream unless AxeAI has an explicit product reason to differ.
   - AxeAI name, identity, icons, update endpoints, release metadata, privacy defaults, and platform behavior remain AxeAI-owned.
   - A repeated conflict must move behind an adapter or be recorded by `git rerere`; do not keep solving the same scattered conditional.
6. Validate affected packages and the complete desktop path.
7. Merge the verified sync branch into `axeai/integration`.
8. Promote the exact verified commit to `main` only as a separate, authorized release decision.

If a sync is broken or incomplete, abandon or repair only its bounded sync branch. Continue unrelated feature work from the last verified integration commit.

## Feature boundaries

- Prefer additive modules, adapters, and capability checks over edits across upstream internals.
- Keep macOS-native behavior behind the desktop preload contract and Electron main process. The web app must feature-detect the capability and retain a working fallback.
- Keep risky or incomplete behavior behind a default-off feature flag until its failure and fallback paths are tested.
- Do not patch generated app bundles, release directories, vendored dependencies, or build output. Change their source configuration or build pipeline.
- Keep commits small enough that an upstream change, an AxeAI adaptation, and a product feature can be reviewed or reverted independently.

## Promotion checks

The exact integration commit proposed for `main` must pass:

- Turbo typechecks and tests for every affected package.
- Desktop main and preload tests for native contract changes.
- A packaged macOS launch check, including entitlements and privacy usage descriptions for native features.
- Light and dark appearance checks at normal and collapsed sidebar widths.
- Keyboard, VoiceOver label, reduced-motion, permission-denied, and unsupported-platform checks for new controls.
- The primary create-thread, follow-up, browser, update, and relaunch workflows when their code paths changed.

Record the commands and results. Promotion copies a known commit; it does not rebuild the change by hand on `main`.

## Rollback

Tag or record every shipped `main` commit. If a release regresses, revert or repoint to the last known-good commit and publish through the normal release path. Never repair a shipped branch by force-pushing rewritten history.
