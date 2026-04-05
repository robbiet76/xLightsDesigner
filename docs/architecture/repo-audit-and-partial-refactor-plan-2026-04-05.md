# Repo Audit And Partial Refactor Plan

Date: 2026-04-05
Status: Active

## Goal

Pause feature expansion long enough to restore clear structure and ownership in the repository.

This is a partial refactor plan, not a rewrite plan.

The intent is:

1. keep the current product direction intact
2. reduce architectural drag before more sequencing and training work lands
3. remove ambiguity about what is active, promoted, historical, generated, or ad hoc

## Executive Summary

The repository is not failing because of one bad subsystem.

It is accumulating complexity in four places at once:

1. `apps/xlightsdesigner-ui/app.js` is too large and owns too many unrelated runtime concerns.
2. `apps/xlightsdesigner-ui/eval` has grown into a mixed surface of core tools, manual tools, baselines, versioned suites, and ad hoc reports without a formal lifecycle manifest.
3. desktop-side live validation orchestration still has too much coupling to app/runtime lifecycle.
4. tracked analysis corpora and large eval JSON files are living in production-adjacent locations without a clearer boundary between product code and dataset/eval assets.

The correct response is not a rewrite.

The correct response is a bounded cleanup with explicit ownership seams and artifact lifecycle rules.

## Measured Hotspots

### Tracked first-party source hotspots

Largest tracked first-party code files observed in the repo:

- `apps/xlightsdesigner-ui/app.js`: `13,547` lines
- `apps/xlightsdesigner-analysis-service/main.py`: `4,537` lines
- `apps/xlightsdesigner-desktop/main.mjs`: `2,981` lines
- `apps/xlightsdesigner-ui/eval/run-designer-eval.mjs`: `2,195` lines
- `apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-runtime.js`: `2,188` lines
- `apps/xlightsdesigner-desktop/live-validation-suites.mjs`: `1,536` lines
- `apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js`: `1,199` lines
- `apps/xlightsdesigner-ui/agent/audio-analyst/audio-analyst-runtime.js`: `1,010` lines
- `apps/xlightsdesigner-ui/runtime/automation-runtime.js`: `920` lines
- `apps/xlightsdesigner-ui/agent/sequence-agent/command-builders.js`: `895` lines

### Eval and dataset hotspots

Tracked large JSON assets include:

- `apps/xlightsdesigner-analysis-service/eval/corpus/structure_corpus_christmas_overfetch.json`: `25,445` lines
- `apps/xlightsdesigner-analysis-service/eval/corpus/structure_corpus_christmas_top50_matched.json`: `4,941` lines
- `apps/xlightsdesigner-analysis-service/eval/corpus/structure_corpus_christmas_top50_unique_titles.json`: `4,731` lines
- `apps/xlightsdesigner-analysis-service/eval/corpus/structure_corpus_top50_christmas.json`: `1,621` lines
- `training-packages/training-package-v1/modules/audio_track_analysis/datasets/structure_corpus_top50_holiday_keywords.json`: `4,748` lines

### Eval folder footprint

`apps/xlightsdesigner-ui/eval` currently contains:

- `33` files
- a mix of:
  - active runners
  - manual control runners
  - versioned suite JSONs
  - frozen baselines
  - reporting tools
  - fixtures

### Important note about renderer duplication

The workspace contains a mirrored renderer tree under:

- `apps/xlightsdesigner-desktop/renderer`

It currently contains roughly:

- `203` JS/MJS/JSON files
- about `2.9M` in workspace size

But it is **not tracked by git**.

That means:

- this duplication is a workflow/build-output problem, not a tracked-source duplication problem
- we still need to account for it because it affects local complexity and editing discipline
- but it should not be treated as a repository cleanup target in the same way as tracked source

## What Is Architecturally Sound

These parts are directionally correct and should be preserved:

1. analysis -> reviewed timing tracks -> sequencing
2. `SequenceSession` as the boundary for live sequence/show/media context
3. reviewed timing provenance:
   - `source`
   - `userFinal`
   - `diff`
4. timing-track taxonomy as the broader sequencing substrate
5. externalizing live whole-sequence orchestration out of the desktop runtime where possible

## What Needs Refactoring

### A. `app.js` ownership concentration

`apps/xlightsdesigner-ui/app.js` still mixes:

- app shell state
- xLights integration
- show/sequence/media context
- analysis orchestration
- timing-track review actions
- sequencing generation/apply gates
- automation exposure
- screen rendering and page-state plumbing

This is the highest-value refactor target in tracked source.

### B. Eval lifecycle ambiguity

`apps/xlightsdesigner-ui/eval` currently lacks a manifest that answers:

- what is the promoted runner for each phase?
- what is manual-only?
- what is training-only?
- what is frozen historical baseline?
- what can be archived?

This is now a maintenance problem.

### C. Desktop live validation coupling

`apps/xlightsdesigner-desktop/main.mjs` and `live-validation-suites.mjs` still carry runtime/eval coupling that should be reduced further.

The app should expose stable primitives.
The runners should own scenario loops.

### D. Product code vs eval/data boundary

Large tracked eval corpora and datasets are living near production code.

That is not inherently wrong, but the boundary is weak. The repo should make it obvious which assets are:

- runtime product dependencies
- evaluation corpora
- training datasets
- frozen baselines
- historical artifacts

## Partial Refactor Principles

1. No rewrite.
2. No behavioral churn unless it reduces ambiguity or duplicated ownership.
3. Prefer extraction by responsibility seam.
4. Freeze new top-level eval entry points until lifecycle inventory exists.
5. Promote one current path per workflow and archive the rest deliberately.

## Proposed Partial Refactor Workstreams

### Workstream 1: Eval Inventory And Lifecycle Control

Deliverables:

- `apps/xlightsdesigner-ui/eval/manifest.json` or equivalent machine-readable manifest
- updated `apps/xlightsdesigner-ui/eval/README.md`
- classification for every file:
  - `active_core`
  - `active_manual`
  - `training_only`
  - `historical_baseline`
  - `candidate_archive`

Checklist:

- [ ] inventory every file in `apps/xlightsdesigner-ui/eval`
- [ ] record owner, purpose, invocation path, and status
- [ ] identify one promoted live benchmark entry point
- [ ] identify one promoted timing validation entry point
- [ ] mark historical suite/baseline versions explicitly
- [ ] move archive candidates into an archive location or delete if clearly obsolete

### Workstream 2: Continue `app.js` Extraction By Seam

Priority extraction seams:

1. sequence/show/media session ownership
2. timing-track review and provenance actions
3. automation runtime exposure and health reporting
4. page-state assembly and screen-specific logic
5. analysis orchestration coordination

Checklist:

- [ ] keep `SequenceSession` as the single owner for live sequence context truth
- [ ] extract timing-review actions into a dedicated runtime/service module
- [ ] extract automation exposure from `app.js` into a narrower bridge
- [ ] reduce direct screen/page-state assembly in `app.js`
- [ ] document which responsibilities remain in `app.js` after each slice

### Workstream 3: Thin The Desktop Runtime Surface

Goal:

- desktop main process owns automation primitives, not scenario-loop orchestration

Checklist:

- [ ] continue moving scenario-loop orchestration to external runners
- [ ] keep `main.mjs` focused on windowing, IPC, filesystem, and automation primitives
- [ ] keep `live-validation-suites.mjs` only as a compatibility layer if still needed
- [ ] remove or deprecate suite orchestration paths that duplicate external runner behavior

### Workstream 4: Clarify Data And Corpus Boundaries

Checklist:

- [ ] inventory large tracked JSON artifacts in analysis-service `eval/`
- [ ] classify each as runtime dependency, eval corpus, or historical artifact
- [ ] move training-only or benchmark-only corpora under a clearer training/eval data area if appropriate
- [ ] avoid storing new large benchmark datasets next to runtime modules without explicit reason

### Workstream 5: Workspace Discipline Around Generated Renderer Copies

This is not a tracked-source cleanup item, but it still matters.

Checklist:

- [ ] document how `apps/xlightsdesigner-desktop/renderer` is produced
- [ ] document whether it is authoritative or generated
- [ ] ensure contributors know which tree to edit
- [ ] if possible, reduce accidental drift between source UI and renderer copy

## Recommended Execution Order

1. Eval inventory and lifecycle manifest
2. `app.js` extraction of timing-review and automation seams
3. further thinning of desktop live validation coupling
4. data/corpus boundary cleanup
5. renderer-copy workflow clarification

## What To Freeze During This Cleanup

Temporarily avoid:

- adding more top-level eval runners
- adding more versioned suite files unless strictly required
- expanding timing-track family implementation beyond current active sequencing need
- broad new audio-analysis heuristics

This freeze should hold only long enough to restore structure.

## Exit Criteria

We should consider the repo back in a clean working state when:

1. every eval file has an explicit lifecycle status
2. the promoted live benchmark and promoted timing validation entry points are obvious
3. `app.js` has materially fewer responsibilities and a documented remainder
4. desktop runtime no longer owns duplicate suite orchestration paths we do not need
5. large datasets/corpora have explicit ownership and location rationale

## Immediate Next Step

Start with Workstream 1.

That gives the fastest clarity with the lowest behavioral risk, and it prevents more evaluation-surface growth while the deeper refactor proceeds.
