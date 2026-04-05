# Eval And App Growth Audit

Date: 2026-04-05
Status: Active

## Purpose

This audit answers three practical questions:

1. Is the codebase accumulating orchestration and validation code faster than it is being consolidated?
2. Which `apps/xlightsdesigner-ui/eval` files are part of the active workflow versus manual or legacy tooling?
3. Does `apps/xlightsdesigner-ui/app.js` need refactoring because of dead code, or because too much live logic still lives in one file?

## Short Answer

Yes, growth is real.

- `app.js` is too large and still owns too many unrelated responsibilities.
- The `eval/` folder contains a useful core, but it also contains many manual runners and versioned suite files that are not part of a single clean, current evaluation surface.
- The immediate problem is not proven dead code. The immediate problem is unclear ownership, duplicated orchestration paths, and a lack of an explicit lifecycle for eval runners and suite versions.

## Measured Size

Current measured file sizes:

- `apps/xlightsdesigner-ui/app.js`: `13,547` lines
- `apps/xlightsdesigner-desktop/live-validation-suites.mjs`: `1,536` lines
- `apps/xlightsdesigner-ui/runtime/automation-runtime.js`: `920` lines
- `apps/xlightsdesigner-ui/eval/run-designer-eval.mjs`: `2,195` lines
- `apps/xlightsdesigner-ui/eval/run-live-reviewed-timing-wholesequence-baseline.mjs`: `410` lines
- `apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs`: `361` lines
- `apps/xlightsdesigner-ui/eval/run-live-reviewed-timing-control-suite.mjs`: `229` lines

Eval folder footprint:

- `apps/xlightsdesigner-ui/eval`: `33` files
- total size: `376K`

These numbers do not prove bloat by themselves, but they confirm that the evaluation surface has become large enough to need active structure and lifecycle rules.

## What Is Clearly In Use

These files are clearly part of the active workflow because they are referenced by tests, specs, or training scripts.

### Core active runners

- `run-designer-eval.mjs`
  - used by `scripts/designer-training/run-overnight-training.sh`
  - referenced by designer eval specs
- `run-live-practical-benchmark.mjs`
  - referenced by sequence-agent roadmap/specs
  - acts as the combined promoted live benchmark entry point
- `compare-live-practical-benchmark.mjs`
  - referenced by sequence-agent roadmap/specs
  - compares fresh benchmark output against frozen baselines
- `build-phase2-issue-ledger.mjs`
  - referenced by sequence-agent roadmap/specs
  - converts benchmark results into a backlog artifact
- `run-section-practical-sequence-validation.mjs`
  - covered by an explicit test
- `run-timing-track-control-validation.mjs`
  - covered by an explicit test
  - referenced by timing-track workflow checklist

### Active suite data used by scripts or promoted workflow docs

- `live-design-canary-suite-v1.json`
  - used by `scripts/designer-training/run-overnight-training.sh`
- `live-design-validation-suite-v1.json`
  - used by `scripts/designer-training/run-overnight-training.sh`
- `live-design-validation-suite-extended-v1.json`
  - used by `scripts/designer-training/run-overnight-training.sh`
- `designer-eval-cases-v1.json`
  - referenced by designer eval specs
- `synthetic-metadata-fixture-v1.json`
  - referenced by designer eval specs

## What Exists But Is Not Clearly Integrated

These files are present and described in `apps/xlightsdesigner-ui/eval/README.md`, but they do not currently show strong external references beyond docs or direct manual invocation.

### Timing and reviewed-timing runners

- `run-live-reviewed-timing-control-suite.mjs`
- `run-live-reviewed-timing-wholesequence-baseline.mjs`
- `live-reviewed-timing-control-suite-v1.json`
- `live-reviewed-timing-wholesequence-baseline-suite-v1.json`

These are real and useful, but today they are still manual control tools, not yet part of a promoted automated gate such as training scripts or a single benchmark umbrella command.

### Reporting and one-off tools

- `report-audio-analysis-quality.mjs`
- `report-visual-hint-definitions.mjs`
- `run-audio-analysis-corpus-benchmark.mjs`

These currently look like ad hoc reporting tools rather than first-class lifecycle-managed evaluation entry points.

### Versioned suite files without a clear promotion/retirement policy

Examples:

- `live-multisection-practical-sequence-validation-suite-v1.json`
- `live-multisection-practical-sequence-validation-suite-v2.json`
- `live-section-practical-sequence-validation-suite-v1.json`
- `live-section-practical-sequence-validation-suite-v2.json`
- `live-wholesequence-practical-validation-suite-v1.json`
- `live-wholesequence-practical-validation-suite-v2.json`
- `live-practical-benchmark-baseline.v1.json`
- `live-practical-benchmark-baseline.v2.json`
- `live-practical-benchmark-baseline.v3.json`

Versioning itself is fine. The problem is that there is no single current manifest that says:

- which version is promoted
- which versions are retained only for historical comparison
- which versions should no longer be used

## App.js Audit

`apps/xlightsdesigner-ui/app.js` is large because it still owns too many live responsibilities.

The issue is not simply dead code. The issue is concentration of ownership.

### Responsibilities currently mixed in `app.js`

- top-level app state and persistence
- xLights connection and refresh flows
- sequence/show/media context handling
- analysis orchestration
- timing-track provenance and review actions
- sequencing generation and apply gates
- automation runtime wiring
- page-state assembly and screen rendering

This makes `app.js` the integration point for nearly every runtime concern. That is why stale-context and orchestration bugs keep surfacing there.

### Current architectural reading

- `app.js` is definitely still used
- it is not safe to treat it as mostly dead code
- but it is too large to be the long-term home for session logic, automation wiring, timing review workflow, and analysis orchestration together

The recently added `SequenceSession` boundary is the right kind of extraction. More of that is needed.

## What We Know About Usage

Current codebase understanding is good enough to say this:

1. Not everything in `eval/` is part of the active promoted workflow.
2. Some files are clearly active via scripts/tests/specs.
3. Some files are manual tools that may still be useful but are not lifecycle-managed.
4. Some versioned suite files likely remain only because no explicit retire/archive policy exists.

So the correct answer to "how much is actually being used?" is:

- we know the core active set
- we do not yet have a formal lifecycle inventory
- we should create one before adding more eval surface

## Recommendations

### 1. Freeze new eval entry points temporarily

Do not add more top-level `eval/*.mjs` runners until the folder has a lifecycle map.

### 2. Create an eval manifest

Add one machine-readable manifest for `apps/xlightsdesigner-ui/eval` that classifies each file as one of:

- `active_core`
- `active_manual`
- `training_only`
- `historical_baseline`
- `candidate_archive`

Each entry should include:

- owner area
- purpose
- primary invocation path
- current status

### 3. Promote a single current benchmark surface

For sequence-side work, there should be one promoted top-level live benchmark command and one promoted timing validation command.

Everything else should either:

- feed those commands
- or be explicitly marked historical/manual

### 4. Continue refactoring `app.js` by ownership seam, not by random extraction

Priority seams:

1. `SequenceSession` / show-sequence-media context
2. timing-track workflow and provenance actions
3. automation runtime exposure
4. page-state assembly and screen-specific logic
5. analysis orchestration

### 5. Add a retire/archive policy for suite versions

For every `v1`, `v2`, `v3` suite or baseline:

- mark one as promoted
- mark one as retained historical baseline if needed
- archive or remove versions that no longer serve comparison or reproducibility

## Recommended Immediate Cleanup Plan

1. Inventory every file in `apps/xlightsdesigner-ui/eval`
   - classify as active core / active manual / training only / historical baseline / candidate archive
2. Add an eval manifest and update `eval/README.md` to reflect it
3. Identify versioned suite files that can be archived now
4. Keep refactoring `app.js` using the current `SequenceSession` seam
5. Only after that, continue expanding reviewed-timing and sequencing validation

## Bottom Line

The codebase is not obviously full of dead logic.

The real problem is this:

- too many top-level eval artifacts without lifecycle control
- too much stateful integration logic concentrated in `app.js`
- too much growth before enough consolidation

That means the next right move is an explicit inventory-and-lifecycle pass, not blind deletion and not more runner proliferation.
