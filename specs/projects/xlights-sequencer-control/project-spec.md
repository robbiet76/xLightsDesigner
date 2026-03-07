# Project Spec: xLights Full Sequencer Control for xLightsDesigner

Status: In Progress (Sprint 0)  
Date: 2026-03-07  
Project type: Program-level control contract (multi-phase)

## 1) Objective
Enable xLightsDesigner to read the xLights environment and perform end-to-end sequence authoring via xLights APIs, while keeping sequencing logic in xLightsDesigner/agents and keeping xLights changes limited to API hooks.

## 2) Design Principles
- xLights remains execution engine and source of truth.
- xLightsDesigner owns orchestration and creative/planning logic.
- xLights API additions are deterministic control hooks, not embedded design intelligence.
- Backward compatibility with existing xLights automation is preserved.

### 2.1 Logic Boundary Rule (Hard Requirement)
- xLights API layer must remain low-level and xLights-native:
  - expose authoritative state,
  - execute requested mutations,
  - expose raw/structured readback data.
- xLights API layer must not implement next-level interpretation logic:
  - no creative scoring,
  - no agent decision heuristics,
  - no outcome ranking/optimization logic,
  - no reimplementation of xLightsDesigner planning behavior.
- All higher-order reasoning lives in xLightsDesigner/agent workflows.

## 3) Scope Boundaries

### 3.1 In Scope
- Read-only layout/environment discovery needed for sequence planning.
- Read-only spatial layout discovery needed for agent-side virtual scene reconstruction (model transforms, camera context, and node coordinates).
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
- System can read deterministic model transform metadata (world position, rotation, scale) needed for spatial reasoning.
- System can read deterministic per-node coordinate metadata (buffer/grid and world/screen-projected coordinates as available) needed for virtual layout visibility.
- System can read camera/viewpoint metadata needed for per-preview render-style decisions.
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
- System can set the active display/model element subset used for sequencing (include-only list), without requiring layout/model configuration edits.
- Subset selection and ordering must be independently controllable because render output depends on element order.

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

### FR-9 Virtual Vision Readiness
- API surface must be sufficient for xLightsDesigner agents to reconstruct a virtual scene of the layout without UI scraping.
- Virtual scene reconstruction must be possible using API payloads only:
  - model transforms + dimensions,
  - node coordinate mappings,
  - available camera definitions,
  - render-style options and selected render-style values for effect layers.
- Render-style controls must be scriptable via explicit API contracts (not ad-hoc settings-string mutation only).

## 6) Non-Functional Requirements
- No dependence on implicit UI selection state for API semantics.
- Explicit error codes/messages for all failures.
- Reasonable runtime for song-length operations.
- Script/CI friendly payloads and status codes.

## 7) API Contract Policy
- New work uses `apiVersion: 2` envelope.
- New commands are namespaced (`system.*`, `sequence.*`, `layout.*`, `timing.*`, `sequencer.*`, `effects.*`, `media.*`).
- New command capabilities are additive and feature-detectable via `system.getCapabilities`.
- API contracts should prefer data availability over embedded interpretation; interpretive logic belongs in xLightsDesigner.
- Legacy command surface is compatibility-only:
  - no new feature capability is added to legacy commands,
  - legacy changes are limited to bugfixes and safety/non-interactive hardening,
  - all net-new sequencing capability lands in v2 contracts first.
- Avoid full legacy API rewrite while program delivery is active:
  - preserve existing behavior for external consumers,
  - reduce duplicate logic incrementally by routing shared internals to common helpers,
  - keep the legacy regression suite as a required gate to prevent compatibility drift.

## 8) Acceptance Criteria
- xLightsDesigner can execute a full non-UI sequencing loop:
  - discover environment
  - open/create sequence and attach media
  - create/edit timing artifacts
  - create/edit effects and layers
  - read back summaries for verification
- xLightsDesigner can reconstruct a deterministic virtual layout scene (model transforms + node coordinates + camera context) from API data only.
- No controller APIs are required.
- Layout writes remain out of scope and are blocked by contract.

## 9) Sprint 0: Agent v1 Contract Lock

### 9.1 Supported v1 agent verbs
- `analyze`
- `propose_changes`
- `refine_proposal`
- `apply_approved_plan`

### 9.2 v1 apply requirements
- explicit user approval action
- explicit scope (targets and time range, or explicit full-sequence confirmation)
- base revision token present and current
- pre-apply `system.validateCommands` pass

### 9.3 v1 non-goals
- controller/output configuration
- layout/model write operations
- autonomous unapproved background mutation
- implicit global rewrites without elevated confirmation

### 9.4 Audio analysis first-step requirement (v1)
- After sequence selection/open, agent must execute an analysis-first pass before major mutation proposals:
  - read sequence-attached media file
  - derive song structure and produce structure timing track
  - derive tempo/time-signature/beats/bars and produce timing tracks
  - optionally enrich via web track research
  - optionally derive lyrics timing track (secondary goal)
  - synthesize a creative brief (tone, mood, story/arc) and attach to sequence context

### 9.5 Guided collaboration + settings assistance (v1)
- Agent must operate as a guided creative partner, not only a command translator.
- Agent must lead high-level project/sequence dialogue and resolve intent gaps before planning.
- Agent can update editable app settings/forms when requested, and may offer to apply suggested setting changes.
- Any settings mutation must be explicitly confirmed by the user before commit.

### 9.6 Sequencing skill ownership and director split (v1)
- Agent must be capable of end-to-end sequence authoring operations within API scope, including model/submodel targeting and effect/layer manipulation.
- Agent is responsible for sequencing technique decisions (what effect family, where, and why) based on user goals and constraints.
- User interaction should stay primarily at director level (creative direction, priorities, constraints), not low-level effect programming.
- Agent should ask for sequencing specifics only when needed to resolve genuine ambiguity or explicit user preference.
