# Training Package Architecture (v1)

Status: Active (architecture baseline)
Date: 2026-03-10
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

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
- `agents/registry.json`
- `agents/*.agent.json`

## 3) Three Module Model (Hard Requirement)
The training package must maintain these three first-class modules:

1. `audio_track_analysis`
- scope: fingerprint/tempo/meter/lyrics/chords/song-structure inference
- outputs: analysis artifacts and structure/brief evidence (no xLights mutations)

2. `lighting_design_principles`
- scope: visual storytelling heuristics (energy arc, contrast, color intent, hierarchy)
- outputs: design rationale and sequencing intent constraints

3. `xlights_sequencer_execution`
- scope: deterministic plan generation + safe apply orchestration over xLights APIs
- outputs: validate/apply-ready command plans, timing-track write decisions, and write/readback verification

## 4) Asset Types by Module
Each module follows the same asset categories:
- `prompts/` (system/task prompts)
- `datasets/` (curated local corpora + references)
- `fewshot/` (model-agnostic example IO)
- `eval/` (runner and metrics configuration)
- optional `contracts/` (capability requirements and schema bindings)

## 4.1) Agent Layer (Role Binding)
The training package must include an agent-layer mapping that binds runtime roles to module assets.

Required files:
- `agents/registry.json`: lists runtime agent ids and profiles.
- `agents/*.agent.json`: per-agent role profile, owned modules, outputs, and handoff contracts.

Minimum required agent ids:
- `audio_analyst`
- `designer_dialog`
- `sequence_agent`

Transition note:
- `sequencer_designer` may remain as a temporary runtime alias during migration.
- Package metadata target is `sequence_agent` as canonical execution role.

## 4.2) Cross-Role Boundary Contract
`audio_analyst`:
- model/domain analysis only
- xLights-independent, supports offline/batch analysis workflows

`designer_dialog`:
- lighting-design reasoning and intent authoring
- no direct xLights command execution

`sequence_agent`:
- technical xLights implementation
- owns timing-track creation choices and all mutation writes
- consumes intent + analysis handoffs

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
- agent-layer registry/profiles exist and map runtime roles to modules,
- active specs reference this package as source of truth for agent-training assets,
- at least one working eval harness is wired under module `eval/`.
