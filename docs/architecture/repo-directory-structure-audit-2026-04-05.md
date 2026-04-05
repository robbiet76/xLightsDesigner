# Repo Directory Structure Audit 2026-04-05

## Goal
Create a clear distinction between:
- product source of truth
- evaluation and validation tooling
- training and corpus assets
- generated working data
- archived planning/history

The repo has grown organically. The main structural risk is not only large files, but top-level and near-root directories that act as mixed-purpose work buckets.

## Current Top-Level Assessment

### Canonical tracked roots
- `apps/`
  - Primary product code.
  - This should remain the top-level owner for shipped/runtime code.
- `scripts/`
  - Operational, audit, validation, and training scripts.
  - Still needed, but it is too flat in places.
- `specs/`
  - Planning, contracts, checklists, architecture notes.
  - Reasonable root, but active vs archived material must stay explicit.
- `docs/`
  - Curated reference docs and architecture/operations summaries.
- `training-packages/`
  - Canonical training-package assets and corpora.

### Non-canonical working roots currently under repo root
- `logs/`
  - Not tracked.
  - Mixed state: some children ignored, some not.
  - This is a drift risk.
- `var/`
  - Not tracked.
  - Being used for generated outputs and run artifacts.
  - This is the right idea, but it needs to become the one canonical working-output root.
- `render-training/`
  - Ignored working area.
  - Large and operationally useful, but root-level placement makes it feel canonical when it is not.
- `sequence-validation/`
  - Ignored working area.
  - Same issue: useful, but misplaced at repo root.
- `sequence-validation-show/`
  - Ignored working area/show fixture.
  - Should not compete with tracked source roots.

## Main Structural Findings

### 1. The tracked source roots are mostly correct
The tracked code is concentrated in the right places:
- `apps/xlightsdesigner-ui`
- `apps/xlightsdesigner-desktop`
- `apps/xlightsdesigner-analysis-service`
- `scripts/*`
- `specs/*`
- `training-packages/*`

This means the repo is not fundamentally disorganized at the tracked-source level.

### 2. The real directory drift is in root-level working directories
The top-level orphan risk is mostly:
- generated artifacts
- validation shows
- run logs
- training workspaces

These are useful, but they are not product source.

### 3. `scripts/` needs stronger sub-organization
The biggest flat growth area is:
- `scripts/sequencer-render-training/`

That directory is active, but it behaves like a small subsystem with:
- analyzers
- generators
- manifests
- runners
- evaluators
- comparison/export tools

It should be grouped by pipeline phase rather than remain one large mixed bucket.

### 4. `apps/xlightsdesigner-ui/eval/` is improved but still a special-purpose surface
This directory is much better than before because archive separation now exists, but it is still a hybrid of:
- promoted control runners
- live validation suites
- benchmark baselines
- manual eval tooling

That should remain under `apps/xlightsdesigner-ui/eval/`, but its README and manifest should be treated as the source of truth for what is current.

### 5. `apps/xlightsdesigner-analysis-service/eval/` needs the same lifecycle treatment
This area still contains a mix of:
- retained evaluation utilities
- ad hoc probes
- one-off corpus experiments
- large json corpus files

It likely needs:
- active eval entrypoints
- archive or experimental
- corpus/data split

## Recommended Directory Policy

### Canonical tracked roots to keep
- `apps/`
- `scripts/`
- `docs/`
- `specs/`
- `training-packages/`

### Canonical untracked/generated root to standardize on
- `var/`

Everything operational and generated should trend under `var/`, not under additional root-level working folders.

### Roots to converge away from over time
- `logs/`
  - move toward `var/logs/`
- `render-training/`
  - move toward `var/render-training/` or an explicitly external workspace
- `sequence-validation/`
  - move toward `var/sequence-validation/`
- `sequence-validation-show/`
  - move toward `var/sequence-validation-show/`

The point is not to delete them immediately. The point is to stop treating them as quasi-canonical roots.

## High-Value Cleanup Targets

### 1. Standardize working outputs under `var/`
Priority: high

This is the main structural cleanup.

Recommended target layout:
- `var/logs/`
- `var/render-training/`
- `var/sequence-validation/`
- `var/sequence-validation-show/`
- `var/repo-audit/`

### 2. Reorganize `scripts/sequencer-render-training/`
Priority: high

Recommended phase grouping:
- `scripts/sequencer-render-training/analysis/`
- `scripts/sequencer-render-training/generation/`
- `scripts/sequencer-render-training/evaluation/`
- `scripts/sequencer-render-training/runners/`
- `scripts/sequencer-render-training/manifests/`
- `scripts/sequencer-render-training/lib/`

Right now the manifests are already separated, but the Python/shell tools are still too flat.

### 3. Tighten eval lifecycle in analysis-service
Priority: medium

Recommended split:
- `apps/xlightsdesigner-analysis-service/eval/active/`
- `apps/xlightsdesigner-analysis-service/eval/archive/`
- `apps/xlightsdesigner-analysis-service/eval/corpus/`

The large json corpus files especially should be separated from executable eval tools.

### 4. Keep `apps/` as the only product-code root
Priority: high

Do not create new product logic under:
- repo root
- `scripts/`
- `var/`
- validation workspaces

## Immediate Practical Conclusion
The repo is not structurally broken at the tracked-source level.
The biggest directory-organization problem is:
- too many root-level working directories that are not canonical source
- one overly flat training-script subtree
- one still-mixed analysis eval subtree

## Recommended Next Cleanup Order
1. Standardize working-directory policy around `var/`
2. Audit and reorganize `scripts/sequencer-render-training/`
3. Audit and lifecycle-split `apps/xlightsdesigner-analysis-service/eval/`
4. Then do a second pass on any remaining root-level drift

## Generated Inventory
- `var/repo-audit/tracked-file-inventory-2026-04-05.json`
