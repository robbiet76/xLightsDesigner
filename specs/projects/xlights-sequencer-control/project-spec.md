# Project Spec: xLights Full Sequencer Control for xLightsDesigner

Status: Draft  
Date: 2026-03-02  
Project type: Program-level control contract (multi-phase)

## 1) Objective
Enable xLightsDesigner to read the xLights environment and perform end-to-end sequence authoring via xLights APIs, while keeping sequencing logic in xLightsDesigner/agents and keeping xLights changes limited to API hooks.

## 2) Design Principles
- xLights remains execution engine and source of truth.
- xLightsDesigner owns orchestration and creative/planning logic.
- xLights API additions are deterministic control hooks, not embedded design intelligence.
- Backward compatibility with existing xLights automation is preserved.

## 3) Scope Boundaries

### 3.1 In Scope
- Read-only layout/environment discovery needed for sequence planning.
- Full sequencer read/write controls needed to create and edit sequences.
- Sequence lifecycle operations.
- Media attachment and audio inspection operations required by sequencing workflows.
- Timing track and timing mark operations.
- Display element ordering/edit operations needed for deterministic sequencing setup.
- Effect read/write operations including layer-aware operations and timing alignment.
- Capability discovery, validation, error model, and dry-run semantics.

### 3.2 Out of Scope
- Controller setup/control and controller visibility APIs.
- Writing model/layout geometry or model configuration.
- Embedding generative sequencing logic directly in xLights.
- Mandatory cloud backends or maintainer-hosted inference.

### 3.3 Hard Rule: xLights Source Boundary
- Permanent xLights code changes for this project are limited to:
  - `xLights/xLightsAutomations.cpp`
  - `xLights/automation/api/*`
- Do not change other xLights source files to make tests pass.
- If a temporary non-API xLights code change is absolutely required for investigation, it must:
  - be logged in `temp-testing-changes.md` before merge,
  - be marked as temporary with explicit revert criteria,
  - be reverted before completion of the work package unless explicitly approved as scope change.

### 3.4 Defect Triage Posture
- Default assumption: if automation behavior is failing, first treat it as harness, fixture, or API-usage error on our side.
- Do not treat this as an absolute guarantee that xLights has no defects.
- If a minimal reproducible case still fails through supported flows, record it as potential upstream defect/edge case and avoid broad source edits.
- Any non-API xLights source edit carries cross-feature regression risk because full xLights regression coverage is not available in this project.

## 4) System Responsibilities

### xLights
- Expose stable, versioned automation hooks.
- Execute mutations against sequence data.
- Return deterministic machine-readable responses.

### xLightsDesigner + Agents
- Decide what to build/edit and in what order.
- Call xLights APIs, validate outcomes, and iterate.
- Handle provider/model reasoning, prompt orchestration, and retries.

## 5) Functional Requirements

### FR-1 Layout Discovery (Read-Only)
- System can list models, groups, views, and display element metadata required for sequencing context.
- No API in this project may mutate model/layout setup.

### FR-2 Sequence Lifecycle
- System can create a new sequence.
- System can open an existing sequence.
- System can save and close sequences.
- System can query active sequence metadata.

### FR-3 Media + Audio
- System can attach/select media for a sequence.
- System can read media metadata needed for timeline operations.
- System can expose analysis plugin availability and media readiness state.

### FR-4 Timing Track and Mark Control
- System can create, rename, delete, and list timing tracks.
- System can insert, replace, delete, and query timing marks.
- System can derive and summarize timing artifacts deterministically.

### FR-5 Display Element Control
- System can read display elements and ordering.
- System can reorder display elements in a deterministic way.

### FR-6 Effect and Layer Control
- System can list effects by model/layer/time range.
- System can create/update/delete effects.
- System can perform bulk operations (shift/align/clone) with explicit filters.
- Layer addressing must be explicit and stable.

### FR-7 Validation + Dry-Run
- Mutating commands support dry-run validation where practical.
- Dry-run must not persist mutations.
- Validation errors must be explicit and parseable.

### FR-8 Compatibility + Determinism
- Legacy automation behavior remains unchanged.
- v2 commands return stable schemas and deterministic keys.

## 6) Non-Functional Requirements
- No dependence on implicit UI selection state for API semantics.
- Explicit error codes/messages for all failures.
- Reasonable runtime for song-length operations.
- Script/CI friendly payloads and status codes.

## 7) API Contract Policy
- New work uses `apiVersion: 2` envelope.
- New commands are namespaced (`system.*`, `sequence.*`, `layout.*`, `timing.*`, `sequencer.*`, `effects.*`, `media.*`).
- New command capabilities are additive and feature-detectable via `system.getCapabilities`.

## 8) Acceptance Criteria
- xLightsDesigner can execute a full non-UI sequencing loop:
  - discover environment
  - open/create sequence and attach media
  - create/edit timing artifacts
  - create/edit effects and layers
  - read back summaries for verification
- No controller APIs are required.
- Layout writes remain out of scope and are blocked by contract.
