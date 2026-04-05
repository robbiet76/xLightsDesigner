# Final Repo Subtree Audit 2026-04-05

Scope:
- final pass after cleanup of `app.js`, `scripts/sequencer-render-training`, and `apps/xlightsdesigner-analysis-service/eval`
- focus on remaining subtree organization risk and whether more structural moves are justified now

## Summary
The repo is now in a materially cleaner state.

At this point, the main remaining mess is not tracked source layout.
It is local working data and local build/vendor output.

That means additional broad directory refactors are no longer the highest-value move.

## What Was Re-checked
Tracked file counts by major subtree:
- `apps/xlightsdesigner-ui`: `252`
- `apps/xlightsdesigner-desktop`: `24`
- `apps/xlightsdesigner-analysis-service`: `26`
- `scripts/sequencer-render-training`: `185`
- `specs`: `167`
- `training-packages`: `39`
- `docs`: `18`

Important distinction:
- on-disk size is no longer a good proxy for tracked complexity
- for example:
  - `apps/xlightsdesigner-desktop` is large on disk because of local `node_modules`, `dist`, and renderer mirror output
  - `apps/xlightsdesigner-analysis-service` is large on disk because of local Python caches and environment material
- those are not the same problem as tracked repo sprawl

## Current State By Subtree
### `apps/xlightsdesigner-ui`
Status:
- acceptable

Why:
- runtime ownership is much better than before
- `app.js` is no longer the dominant architecture risk it was
- `eval/` has already been lifecycle-audited and reduced

No directory restructure is recommended right now.

### `apps/xlightsdesigner-desktop`
Status:
- acceptable as tracked source
- local output hygiene still matters

Why:
- only `24` tracked files remain here
- the apparent size problem is dominated by untracked or local runtime material:
  - `node_modules/`
  - `dist/`
  - local renderer mirror output

Recommendation:
- do not restructure tracked source further right now
- keep local-output hygiene and ignore policy under control

### `apps/xlightsdesigner-analysis-service`
Status:
- acceptable after eval regrouping

Why:
- tracked source is small and understandable
- `eval/` is now grouped into:
  - `runners/`
  - `probes/`
  - `corpus/`
  - `archive/`

Recommendation:
- no further directory restructuring now
- future work should focus on product/runtime quality, not folder moves

### `scripts/sequencer-render-training`
Status:
- much improved
- still the largest tracked tooling subtree, but now organized enough to stop

Why:
- it is now grouped by responsibility:
  - `catalog/`
  - `runners/`
  - `generators/`
  - `evaluation/`
  - `evaluation/fixtures/`
  - `registry/`
  - `tooling/`
  - `analysis/`
  - `manifests/`
  - `archive/`
- further moves should now be conservative and justified by usage, not by shape alone

Recommendation:
- stop major structural moves here for now
- only archive files later when there is stronger evidence than zero-reference scans

### `specs/`
Status:
- acceptable

Why:
- the archive split exists and is visible
- current specs are grouped by product area
- this tree is large, but it is not structurally confused in the same way the previous hotspots were

Recommendation:
- no directory changes now
- future cleanup should be content-lifecycle cleanup, not tree reshaping

### `training-packages/`
Status:
- acceptable

Why:
- it is already versioned and grouped by module
- current shape reflects purpose

Recommendation:
- no structural changes now

### `docs/`
Status:
- acceptable

Why:
- small tree
- `architecture/` and `operations/` split is clear

Recommendation:
- no structural changes now

## Remaining Real Organization Problem
The remaining organization problem is local workspace drift, not tracked source structure.

That includes:
- `logs/`
- `render-training/`
- `sequence-validation/`
- `sequence-validation-show/`

That is already addressed by:
- [working-directory-policy-2026-04-05.md](/Users/robterry/Projects/xLightsDesigner/docs/architecture/working-directory-policy-2026-04-05.md)
- [root-working-directory-migration-plan-2026-04-05.md](/Users/robterry/Projects/xLightsDesigner/docs/architecture/root-working-directory-migration-plan-2026-04-05.md)
- [report-working-directory-drift.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/repo-audit/report-working-directory-drift.mjs)

## Decision
Stop broad structural reorganization here.

The repo is now clean enough structurally that further improvement should come from:
1. product/runtime development
2. targeted dead-code or archive cleanup only when backed by usage evidence
3. local working-data migration into `var/`

## Next Recommended Work
1. stop repo-shape work as the primary activity
2. migrate local working data into `var/` when convenient
3. return to product development on the cleaner base
4. only reopen structural cleanup if a new hotspot emerges from real usage
