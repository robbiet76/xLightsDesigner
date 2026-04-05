# Sequencer Render Training Directory Audit 2026-04-05

Scope:
- [`scripts/sequencer-render-training`](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training)
- special focus on directory organization, orphan risk, and whether the current flat structure still reflects active use

Supporting artifact:
- [`manifest.v1.json`](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/manifest.v1.json)

## Summary
This subtree is useful but structurally weak.

The problem is not that the whole area is obsolete. The problem is that too many different responsibilities live together in one flat root:
- active runners
- manifest generators
- evaluation fixtures
- registry plans
- native/tooling helpers
- historical or one-off scripts
- data files with unclear lifecycle

That makes it hard to answer basic questions:
- which files are active entrypoints
- which files are core catalogs
- which files are experimental or historical
- which files are safe to archive

## Measured State
Reference scan result across:
- `scripts/sequencer-render-training`
- `specs/sequence-agent`
- `apps/xlightsdesigner-ui`
- `training-packages`
- `docs`

Counts:
- total files: `184`
- zero references: `91`
- one reference: `69`
- two or more references: `24`

Manifest classification:
- `active_core`: `6`
- `active_support`: `27`
- `active_manual`: `7`
- `active_data`: `55`
- `candidate_archive`: `89`

Recommendation classification:
- `keep`: `55`
- `move`: `72`
- `modify`: `1`
- `review`: `13`
- `review_for_archive`: `43`

Interpretation:
- the subtree is not dead
- but the current flat root makes active and non-active material indistinguishable
- more than half the files are either archive candidates or need explicit review

## What Is Clearly Core
These are first-class inputs or central planning artifacts and should remain active:
- `effect-parameter-registry.json`
- `generic-layout-model-catalog.json`
- `generic-layout-geometry-audit.json`
- `stage1-effect-model-scope.json`
- `training-standards.json`
- a curated subset of manifest generators and registry-plan runners
- referenced manifests under `manifests/`

## What Is Clearly Structurally Wrong
### 1. Flat root overload
The root currently mixes:
- `run-*`
- `generate-*`
- `evaluate-*`
- `build-*`
- `extract-*`
- registry JSON
- evaluation fixtures
- native helper sources
- general support scripts

This is the main organization problem.

### 2. Too many data files with no visible lifecycle
The root contains many JSON files that are either:
- planning inputs
- evaluation fixtures
- generated artifacts
- historical variants

They need explicit placement by purpose.

### 3. Working-path drift
The README and some scripts still assume output roots like:
- `render-training/...`

That conflicts with the new working-directory policy under:
- `var/`

## Target Structure
The subtree should be reorganized into explicit responsibility groups.

Recommended target layout:
- `scripts/sequencer-render-training/README.md`
- `scripts/sequencer-render-training/manifest.v1.json`
- `scripts/sequencer-render-training/catalog/`
- `scripts/sequencer-render-training/runners/`
- `scripts/sequencer-render-training/generators/`
- `scripts/sequencer-render-training/evaluation/`
- `scripts/sequencer-render-training/evaluation/fixtures/`
- `scripts/sequencer-render-training/registry/`
- `scripts/sequencer-render-training/manifests/`
- `scripts/sequencer-render-training/tooling/`
- `scripts/sequencer-render-training/archive/`
- `scripts/sequencer-render-training/archive/historical/`
- `scripts/sequencer-render-training/archive/experimental/`

Purpose of each group:
- `catalog/`: stable planning and training catalogs
- `runners/`: operator-facing execution entrypoints
- `generators/`: reports, planning artifacts, and manifest-generation scripts
- `evaluation/`: evaluator scripts
- `evaluation/fixtures/`: evaluation-case JSON files
- `registry/`: registry-planning JSON and related support
- `manifests/`: active render-manifest inputs
- `tooling/`: native helpers and extraction/build utilities
- `archive/`: historical, superseded, or currently unreferenced assets

## Recommended File-Level Treatment
### Keep active where they are for now, but mark as core
Examples:
- `effect-parameter-registry.json`
- `generic-layout-model-catalog.json`
- `generic-layout-geometry-audit.json`
- `stage1-effect-model-scope.json`
- `training-standards.json`

### Move in the next cleanup pass
These are active enough to keep, but belong under clearer directories:
- all `run-*` scripts -> `runners/`
- all `evaluate-*` scripts -> `evaluation/`
- most `generate-*` scripts -> `generators/`
- `registry-planning-*.json` -> `registry/`
- `*-intent-eval-cases*.json`, `priority-effect-selection-cases*.json`, `controlled-designer-vocab*.json` -> `evaluation/fixtures/`
- `analysis/*` -> either `tooling/analysis/` or `analysis/` under the new grouped layout

### Review before moving or archiving
These are the highest orphan-risk categories:
- `build-*`
- `extract-*`
- `fseq_window_decoder.cpp`
- `slice-gif-by-time.swift`
- `lib.sh`
- low-reference one-off scripts like:
  - `get-model-fseq-metadata.py`
  - `scan-fseq-active-ranges.py`

These may still be useful, but they are not well integrated into the active documented flow.

### Archive candidates
The strongest archive candidates are:
- unreferenced manifest variants
- unreferenced evaluation-case JSONs
- zero-reference historical scripts that are not called by the promoted runners

Do not delete them immediately. Move them under `archive/` first and update the manifest.

## First Safe Cleanup Pass
This is the first pass that should happen before any functional changes:
1. rewrite the subtree README around the new grouped layout and `var/` working-output policy
2. create empty grouped directories listed above
3. move only clearly classified files:
   - `run-*` -> `runners/`
   - `evaluate-*` -> `evaluation/`
   - evaluation fixtures -> `evaluation/fixtures/`
   - `registry-planning-*.json` -> `registry/`
4. leave `manifests/` in place for now
5. leave native/build/extract helpers in place until their active usage is confirmed
6. move zero-reference historical files to `archive/` only after path updates are staged

## Repo-Level Relation
This subtree is one of the two biggest remaining organizational hotspots in the repo.

It is not a product-runtime boundary problem like `app.js` was. It is a tooling-surface problem.

So the right cleanup order is:
1. reorganize this subtree into responsibility groups
2. then do the same lifecycle split for `apps/xlightsdesigner-analysis-service/eval`
3. then revisit any remaining root-level orphan work directories

## Conclusion
This area should be kept, not rewritten from scratch.

But it should no longer remain as a flat mixed root.

The correct next move is a structural reorganization driven by:
- the new file-level manifest
- the `var/` working-directory policy
- explicit grouping by responsibility

That will reduce orphan risk without breaking the active render-training pipeline.
