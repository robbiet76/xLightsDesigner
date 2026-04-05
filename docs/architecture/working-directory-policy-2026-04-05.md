# Working Directory Policy 2026-04-05

## Purpose
Separate canonical tracked source from generated and operational working data.

## Canonical Tracked Roots
These directories are source of truth and should contain tracked project assets:
- `apps/`
- `scripts/`
- `docs/`
- `specs/`
- `training-packages/`

## Canonical Untracked Working Root
Use `var/` for generated and operational outputs.

Examples:
- `var/logs/`
- `var/repo-audit/`
- `var/render-training/`
- `var/sequence-validation/`
- `var/sequence-validation-show/`

## Deprecated Root-Level Working Directories
These should not gain new workflow dependencies.
They may exist temporarily during migration, but they are not canonical roots.

- `logs/`
- `render-training/`
- `sequence-validation/`
- `sequence-validation-show/`

## Rules
1. New generated artifacts should go under `var/`.
2. New product logic should not be added outside `apps/`.
3. New operational scripts should reference `var/` paths by default for writable outputs.
4. Root-level working directories should be treated as migration targets, not expansion points.
5. Archive and eval data that must stay tracked should remain under the owning source tree, not under `var/`.

## Immediate Changes Applied
- Designer training logs now write to `var/logs/designer-training-runs/`.
- `.gitignore` now ignores `logs/` and `var/` as generated roots.

## Next Migration Targets
1. `render-training/` -> `var/render-training/` or external workspace
2. `sequence-validation/` -> `var/sequence-validation/`
3. `sequence-validation-show/` -> `var/sequence-validation-show/`
4. explicit lifecycle split for `apps/xlightsdesigner-analysis-service/eval/`
5. structural regrouping for `scripts/sequencer-render-training/`
