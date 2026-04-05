# Root Working Directory Migration Plan 2026-04-05

Scope:
- root-level non-source working directories in the repo workspace

Supporting tool:
- [report-working-directory-drift.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/repo-audit/report-working-directory-drift.mjs)

Latest local report:
- `/tmp/working-directory-drift-report.json`

## Summary
The remaining root-level organization problem is no longer tracked source layout.

It is local working-output drift.

Current root working directories still present:
- `logs/`
- `render-training/`
- `sequence-validation/`
- `sequence-validation-show/`
- `var/`

These are not source roots. They are working-data roots.

## Current State
Observed locally:
- `logs/`: active legacy logs, especially `designer-training-runs/`
- `render-training/`: large render-training workspace with fixture sequence, manifests, packed `.fseq`, working `.xsq`, and xLights show files
- `sequence-validation/`: standalone validation sequences
- `sequence-validation-show/`: standalone validation show tree
- `var/`: intended canonical untracked workspace root, but still underused

## Key Constraint
These directories contain user data and generated artifacts.

That means:
- they should not be auto-moved blindly by repo cleanup code
- migration should be explicit and reversible
- scripts and docs should be updated first
- data movement should be manual or dry-run-assisted

## Migration Policy
Canonical untracked working root remains:
- `var/`

Target destinations:
- `logs/` -> `var/logs/`
- `render-training/` -> `var/render-training/`
- `sequence-validation/` -> `var/sequence-validation/`
- `sequence-validation-show/` -> `var/sequence-validation-show/`

## What Has Already Been Done
- root working directories are ignored in `.gitignore`
- designer training scripts now target `var/logs/designer-training-runs/`
- render-training docs now prefer `var/render-training/` while tolerating legacy paths

## What Has Not Been Done Yet
- existing local data has not been moved
- root-level validation directories still exist in place
- some legacy specs still mention old absolute root paths for historical context

## Recommended Execution Order
1. keep new writes on `var/` only
2. stop introducing new root-level working directories
3. perform manual migration of existing local data when convenient:
   - copy or move `render-training/` to `var/render-training/`
   - copy or move `sequence-validation/` to `var/sequence-validation/`
   - copy or move `sequence-validation-show/` to `var/sequence-validation-show/`
   - move legacy `logs/` content into `var/logs/`
4. after local migration is complete, remove obsolete empty root-level working directories

## Repo-Level Conclusion
The repo is now much cleaner structurally in tracked code and tooling.

The remaining organizational mess is mostly local working data placement, not source ownership.

That should be handled as a migration policy, not as aggressive source refactoring.
