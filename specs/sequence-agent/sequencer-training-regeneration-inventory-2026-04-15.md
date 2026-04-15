# Sequencer Training Regeneration Inventory

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Inventory the current generated selector/training artifacts, map them to their replacement direction under the reset, and define the raw evidence sources that should feed the rebuilt records.

This spec exists so the rebuild does not drift into:

- partial cutovers
- duplicate artifact paths
- “temporary” dual systems that never get retired

## Governing Specs

- [sequencer-training-reset-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-training-reset-plan-2026-04-15.md)
- [effect-capability-and-parameter-semantics-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/effect-capability-and-parameter-semantics-v1-2026-04-15.md)
- [sequencer-training-records-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-training-records-v1-2026-04-15.md)

## Current Generated Runtime Bundles

Current runtime selector/training bundles:

- [stage1-trained-effect-bundle.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js)
- [derived-parameter-priors-bundle.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/generated/derived-parameter-priors-bundle.js)
- [cross-effect-shared-settings-bundle.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/generated/cross-effect-shared-settings-bundle.js)

## Current Catalog Artifacts

Current catalog artifacts still used by training tooling:

- `scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json`
- `scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json`
- `scripts/sequencer-render-training/catalog/effect-training-automation-plan-v1.json`
- `scripts/sequencer-render-training/catalog/effect-parameter-screening-plan-v1.json`

## Raw Evidence Sources To Preserve

These are the preserved evidence inputs for regeneration:

### 1. Screening Records

Directory:

- `scripts/sequencer-render-training/catalog/effect-screening-records/`

Use:

- source material for `behavior_capability_record_v1`
- source material for `parameter_semantics_record_v1`
- source material for geometry-conditioned rendering summaries

### 2. Effect Parameter Registry

File:

- `scripts/sequencer-render-training/catalog/effect-parameter-registry.json`

Use:

- registry surface for effect settings
- enumeration of candidate high-impact parameters
- runner/manifests scaffolding

### 3. Manifest Set

Directory:

- `scripts/sequencer-render-training/manifests/`

Use:

- bounded sweep definitions
- interaction manifest definitions
- regeneration harness execution inputs

### 4. Outcome / Proof Artifacts

Directory:

- `scripts/sequencer-render-training/proofs/`

Use:

- render observation examples
- critique examples
- sequence learning examples
- render-feedback loop traceability

### 5. Live Outcome Harvest Tools

Key tools:

- `scripts/sequencer-render-training/tooling/harvest-effect-outcome-records.mjs`
- `scripts/sequencer-render-training/runners/run-live-outcome-harvest-cycle.sh`

Use:

- eventual outcome evidence ingestion into rebuilt records

## Replacement Map

### A. `stage1-trained-effect-bundle.js`

Current role:

- selector-ready effect recommendations
- coarse intent tags
- pattern-family ranking
- model bucket support

Status:

- `Transitional runtime dependency`

Replacement direction:

- replace as the primary selector input with regenerated capability-first artifacts built from:
  - `behavior_capability_record_v1`
  - `parameter_semantics_record_v1`
  - `shared_setting_semantics_record_v1`

Retirement rule:

- do not extend this artifact with new selector doctrine
- once the rebuilt selector is live, remove it from primary ranking paths

### B. `derived-parameter-priors-bundle.js`

Current role:

- parameter prior guidance

Status:

- `Preserve and regenerate`

Replacement direction:

- keep the concept
- regenerate from `parameter_semantics_record_v1` and capability evidence instead of older selector summaries

### C. `cross-effect-shared-settings-bundle.js`

Current role:

- cross-effect shared-setting guidance

Status:

- `Preserve and regenerate`

Replacement direction:

- keep the concept
- regenerate from `shared_setting_semantics_record_v1`

### D. `sequencer-unified-training-set-v1.json`

Current role:

- previous umbrella training container

Status:

- `Transitional catalog artifact`

Replacement direction:

- do not evolve this into the new canonical training surface
- replace with record-oriented intermediate artifacts that feed regenerated runtime bundles

### E. `effect-settings-coverage-report-v1.json`

Current role:

- effect registry / coverage planning support

Status:

- `Preserve as planning support`

Replacement direction:

- keep as a coverage/planning report, but do not treat it as selector evidence

### F. `effect-training-automation-plan-v1.json`

Current role:

- old automation scheduling plan

Status:

- `Transitional`

Replacement direction:

- replace with regeneration-harness planning that targets:
  - record generation
  - bundle regeneration
  - batch acceptance

## Rebuild Outputs

The regeneration pipeline should eventually emit:

### Intermediate record artifacts

- `behavior_capability_record_v1`
- `parameter_semantics_record_v1`
- `shared_setting_semantics_record_v1`
- `parameter_interaction_semantics_record_v1`

### Regenerated runtime bundles

- capability-first selector bundle
- parameter semantics bundle
- shared-setting semantics bundle

### Planning reports

- coverage reports
- regeneration reports
- batch acceptance reports
- per-effect canonical training references

## Harness Responsibilities

The regeneration harness must:

1. read preserved raw evidence
2. build canonical record artifacts
3. build interaction-aware record artifacts
4. regenerate runtime bundles from those records
5. run focused validations
6. run the full batch harness
7. emit one consolidated regeneration report

## Retirement Checklist

- [ ] stop treating `stage1-trained-effect-bundle.js` as the canonical selector foundation
- [ ] stop treating `sequencer-unified-training-set-v1.json` as the canonical training surface
- [ ] replace old automation planning with regeneration-harness planning
- [ ] cut old selector bundle consumers once rebuilt bundles are live

## Immediate Implementation Targets

1. inventory existing bundle builders and export tools
2. define the regeneration harness entrypoint
3. build record-generation tooling from screening records
4. regenerate parameter/shared-setting bundles from the new records
5. validate through the full batch harness

## Clean Run Blocker

A clean regeneration run is blocked until the harness consumes preserved interaction manifests, emits `parameter_interaction_semantics_record_v1`, and reports interaction-evidence coverage.
