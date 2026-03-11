# Training Package Architecture (v1)

Status: Active (architecture baseline)  
Date: 2026-03-10

## 1) Purpose
Define a portable training-data and prompt architecture for the Designer agent under a BYO-provider model.

Users bring their own model/API account. The app ships with a reusable training package so behavior is transferable without sharing a maintainer-hosted inference account.

## 2) Package Root
Canonical location:
- `training-packages/training-package-v1/`

Core files:
- `manifest.json`
- `modules/audio_track_analysis/*`
- `modules/lighting_design_principles/*`
- `modules/xlights_sequencer_execution/*`

## 3) Three Module Model (Hard Requirement)
The training package must maintain these three first-class modules:

1. `audio_track_analysis`
- scope: fingerprint/tempo/meter/beats/bars/lyrics/chords/song-structure inference
- outputs: timing tracks and structure/brief evidence

2. `lighting_design_principles`
- scope: visual storytelling heuristics (energy arc, contrast, color intent, hierarchy)
- outputs: design rationale and sequencing intent constraints

3. `xlights_sequencer_execution`
- scope: deterministic plan generation + safe apply orchestration over xLights APIs
- outputs: validate/apply-ready command plans and write/readback verification

## 4) Asset Types by Module
Each module follows the same asset categories:
- `prompts/` (system/task prompts)
- `datasets/` (curated local corpora + references)
- `fewshot/` (model-agnostic example IO)
- `eval/` (runner and metrics configuration)
- optional `contracts/` (capability requirements and schema bindings)

## 5) Distribution and Provider Policy
- Package distribution is app-bundled and/or user-installable.
- API credentials are never stored in the package.
- Runtime inference is user-account owned (OpenAI-compatible or other adapter).
- Package content must be provider-agnostic where possible.

## 6) Data Governance and Licensing Posture
- Prefer derived features and weak labels over raw copyrighted lyric redistribution.
- Keep source lineage in dataset indexes.
- Support user-local corpus augmentation without replacing package structure.

## 7) Runtime Integration Contract (Phase Plan)
Phase A (current):
- Package exists as structured assets + spec source of truth.
- Runtime still uses embedded prompt logic where migration not yet completed.

Phase B:
- Runtime prompt and few-shot selection resolves from package assets first.
- Diagnostics report package version + module asset versions used per analysis run.

Phase C:
- Package manager UI: import/export/version/compatibility checks.
- Cross-provider eval gating before enabling new package versions.

## 8) Versioning Rules
- Package semantic version (`manifest.version`) increments on any behavior-affecting asset change.
- Module versions increment independently; package pins module versions.
- Breaking schema changes require `schemaVersion` major bump.

## 9) Acceptance Criteria
This architecture is considered implemented when:
- all three modules exist with manifests and indexes,
- active specs reference this package as source of truth for agent-training assets,
- at least one working eval harness is wired under module `eval/`.
