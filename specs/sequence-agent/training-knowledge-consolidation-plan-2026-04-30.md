# Training Knowledge Consolidation Plan (2026-04-30)

Status: Active
Date: 2026-04-30
Owner: xLightsDesigner Team

## Purpose

Define the cleanup path for render-training knowledge before more broad training expansion.

The goal is not only to remove old files. The goal is to turn completed training work into a smaller, organized, durable learning layer that is easy to inspect, regenerate, and consume at runtime.

## Problem

The current training system has useful evidence, but the knowledge is spread across too many surfaces:

- dated specs and result readouts under `specs/sequence-agent/`
- generated runtime bundles under `apps/xlightsdesigner-ui/agent/sequence-agent/generated/`
- stable and semi-stable catalogs under `scripts/sequencer-render-training/catalog/`
- large run logs under `var/logs/`
- render-training tooling under `scripts/sequencer-render-training/tooling/`
- portable training-package contracts and datasets under `training-packages/training-package-v1/`

This has been acceptable while proving the pipeline, but it will become expensive as more effects, settings, layer stacks, geometries, and custom model cases are added.

The next training work should not add another parallel layer of records unless the current durable layer is first consolidated.

## Current Durable Learnings

The current learning baseline should be captured from these sources before more training expansion:

- `effects-usage-render-training-results-2026-04-28.md`
- `layer-composition-overnight-results-2026-04-29.md`
- `next-work-plan-2026-04-29.md`
- `effects-usage-render-training-overnight-plan-2026-04-27.md`
- `unattended-layer-composition-training-loop-2026-04-28.md`
- generated bundles currently consumed by the runtime:
  - `stage1-trained-effect-bundle.js`
  - `effect-parameter-registry.js`
  - `behavior-capability-records-bundle.js`
  - `derived-parameter-priors-bundle.js`
  - `layer-composition-priors-bundle.js`
  - `cross-effect-shared-settings-bundle.js`

The durable baseline should include:

- selector-ready effects
- effects with behavior-only records
- current effect-setting gaps
- flat or inconclusive setting pressure
- palette sensitivity findings
- geometry sensitivity findings
- layer-composition findings
- tooling scale findings
- next-run curriculum requirements

## Target Knowledge Layers

### 1. Human-Readable Learning Summary

Location:

`specs/sequence-agent/training-knowledge-baseline-YYYY-MM-DD.md`

Purpose:

- explain what has been learned in plain engineering language
- summarize promoted effects, settings, geometries, palettes, and layer findings
- record known limitations and confidence levels
- point to generated/runtime artifacts without duplicating their full data

This should become the first document a developer reads before changing training behavior.

### 2. Curated Runtime Knowledge Manifests

Location:

`scripts/sequencer-render-training/catalog/`

Purpose:

- store compact canonical source data used to generate runtime bundles
- avoid requiring the app runtime to parse raw run logs or oversized record files
- separate curated learning inputs from raw evidence

These manifests should be stable, compact, and versioned. Raw render evidence can remain available for audit, but it should not be the runtime source.

### 3. Generated Runtime Bundles

Location:

`apps/xlightsdesigner-ui/agent/sequence-agent/generated/`

Purpose:

- provide fast runtime lookup for the sequence agent
- remain generated-only
- avoid hand edits
- expose a small stable module API through existing runtime loaders

Generated bundles should include metadata describing:

- source manifest versions
- generation command
- generation timestamp
- source record counts
- omitted or compacted fields

### 4. Portable Training Package

Location:

`training-packages/training-package-v1/`

Purpose:

- carry durable agent contracts, prompts, and portable datasets
- avoid becoming a dump of large raw render records
- receive curated summaries or compact datasets only when useful outside the local development repo

The portable package should not duplicate every generated runtime bundle. It should carry the contracts and curated data needed for external agent/retrieval use.

### 5. Raw Evidence And Run Logs

Location:

`var/logs/` and temporary run folders

Purpose:

- preserve forensic detail while a run is being analyzed
- allow regeneration or spot checks
- remain subject to retention and disk guardrails

Raw evidence should not be treated as the primary knowledge layer once a run has been promoted.

## Cleanup Rules

- Do not start a broad new training run until the current learning baseline is captured.
- Do not hand-edit generated bundles.
- Do not make runtime code depend directly on raw run logs.
- Do not duplicate the same learning in multiple active specs unless one document is explicitly an index.
- Prefer one durable baseline summary over several dated narrative fragments.
- Keep dated run readouts as evidence, but demote them from canonical entry points after their findings are consolidated.
- Keep generation scripts deterministic enough that a clean checkout can rebuild the generated bundles from curated inputs.
- Preserve enough source counts and provenance to explain why a runtime recommendation exists.

## Immediate Cleanup Sequence

1. Create a training knowledge baseline from the April 28 effects run and April 29 layer-composition run. **Done:** `training-knowledge-baseline-2026-04-30.md`.
2. Update `specs/sequence-agent/README.md` so the baseline and this consolidation plan become canonical entry points for training work. **Done.**
3. Audit generated bundle exports for metadata/provenance coverage. **Done for current runtime bundles.**
4. Add or update generator output metadata where missing. **Started:** derived parameter priors, cross-effect shared settings, behavior capability records, and layer-composition priors now emit explicit provenance metadata.
5. Define which catalog files are curated source inputs and which are intermediate/generated. **Done:** `scripts/sequencer-render-training/catalog/knowledge-inventory.v1.json` classifies the catalog and `validate-training-catalog-inventory.mjs` enforces coverage.
6. Move stale dated training plans/readouts to supporting or archive status once their durable findings are in the baseline.
7. Only then expand the next training run curriculum.

## Cleanup Progress

### 2026-04-30 Runtime Bundle Provenance Slice

Implemented concrete generated-bundle cleanup:

- added consistent provenance metadata to derived parameter priors, cross-effect shared settings, behavior capability records, and layer-composition priors exporters
- regenerated the affected runtime bundles
- removed machine-local absolute raw-evidence paths from checked-in layer-composition runtime records by relativizing observation and pass-plan references to the source run root
- made source paths in checked-in generated bundle provenance repo-relative when they point inside this repository
- added regression coverage for provenance metadata and layer-composition reference compaction
- verified sequence-agent runtime tests still pass against the regenerated bundles

### 2026-04-30 Catalog Inventory Slice

Implemented concrete catalog classification cleanup:

- added a render-training catalog README
- added `knowledge-inventory.v1.json` to classify catalog files by lifecycle
- added a validator that requires every catalog file to be classified exactly once
- added regression coverage for the catalog inventory
- updated render-training docs to make the inventory and validator discoverable

## Baseline Questions To Answer

The consolidated baseline should answer:

- Which effects are selector-ready today?
- Which effects are behavior-observed but not selector-ready?
- Which settings have reliable causal anchors?
- Which settings remain flat, inconclusive, or under-sampled?
- Which findings are palette-sensitive?
- Which findings are geometry-sensitive?
- Which layer-composition findings are strong enough to influence runtime planning?
- Which findings are only evidence for future training, not current runtime behavior?
- What changed in the runtime as a result of the training?
- What should the next training run do differently?

## Refactor Pressure

Current generated bundle sizes are acceptable for development, but they show the need for clearer boundaries:

- `behavior-capability-records-bundle.js` is large enough that it should remain generated and compact.
- `derived-parameter-priors-bundle.js` is large enough that source provenance and regeneration metadata matter.
- `layer-composition-priors-bundle.js` is large enough that the runtime should consume it through a narrow loader API.

The runtime should not grow direct knowledge of every generated bundle shape. Loader modules should normalize generated data into stable query functions.

## Definition Of Done

This cleanup is complete when:

- a current training baseline summarizes durable learnings in one place
- sequence-agent README points to the baseline and consolidation plan
- generated bundles declare their provenance
- active specs no longer require reading multiple dated run reports to understand current training state
- the next training plan can be reviewed as an incremental expansion from the baseline
- no runtime behavior depends on raw run folders
