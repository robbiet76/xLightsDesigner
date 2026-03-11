# Agent Orchestration Architecture

Status: Draft
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## 1) Purpose
Define how multiple agents and LLM capabilities are coordinated in xLightsDesigner so each role has clear ownership and deterministic handoff contracts.

## 2) Agent vs LLM Model
- Agent: workflow role with explicit responsibilities and handoff contracts.
- LLM: inference capability used by an agent for selected reasoning tasks.
- Rule: use deterministic services/code first where possible; use LLM for interpretation, dialog, and synthesis tasks that cannot be done deterministically.

## 3) Required Agent Roles
1. `audio_analyst`
- Owns media fingerprinting, timing/lyrics/chords/section analysis, and evidence summary.
- Produces structured analysis artifacts only.
- Does not write timing tracks or mutate xLights state.

2. `designer_dialog`
- Owns user conversation, intent clarification, creative-brief maintenance, and lighting-design reasoning.
- Decides artistic direction: what should happen visually (tone, mood, energy arc, emphasis, style constraints).
- Produces normalized intent and constraints for sequencing execution.

3. `sequence_agent`
- Owns technical execution in xLights end-to-end.
- Decides how to implement approved artistic intent in xLights APIs.
- Owns plan generation, timing-track creation decisions, validation/apply, readback, rollback, and safety gates.

Transition note:
- Current runtime may still use `sequencer_designer` naming in some files.
- Spec target is `sequence_agent` as canonical role name.

## 4) Handoff Contracts

### 4.1 `analysis_handoff_v1`
Producer: `audio_analyst`  
Consumers: `designer_dialog`, `sequence_agent`

Required fields:
- `trackIdentity` (`title`, `artist`, optional `isrc`)
- `timing` (`bpm`, `timeSignature`, optional confidence/source metadata)
- `structure` (`sections[]`, `source`, `confidence`)
- `lyrics` (`hasSyncedLyrics`, optional line-level timestamps metadata)
- `chords` (`hasChords`, optional chord-event metadata, `confidence`)
- `briefSeed` (`tone`, `mood`, `story`, `designHints[]`)
- `evidence` (`serviceSummary`, `webValidationSummary`, `sources[]`)

### 4.2 `intent_handoff_v1`
Producer: `designer_dialog`  
Consumer: `sequence_agent`

Required fields:
- `goal`
- `mode` (`create|revise|polish|analyze`)
- `scope` (`targetIds`, `tagNames`, `timeRangeMs`)
- `constraints` (`changeTolerance`, `preserve*`, `allowGlobalRewrite`)
- `directorPreferences` (`styleDirection`, `energyArc`, `focusElements`, `colorDirection`)
- `approvalPolicy` (`requiresExplicitApprove`, `elevatedRiskConfirmed`)

### 4.3 `plan_handoff_v1`
Producer: `sequence_agent`  
Consumer: `orchestrator/apply pipeline`

Required fields:
- `planId`
- `summary`
- `estimatedImpact`
- `warnings[]`
- `commands[]`
- `baseRevision`
- `validationReady` (boolean)

## 4.4 Design vs Sequence Boundary (Hard Requirement)
`designer_dialog` scope:
- lighting design reasoning and creative intent synthesis
- dialog/clarification/constraint capture
- creative brief and director preference management
- explicit intent output only

`sequence_agent` scope:
- xLights-aware technical plan synthesis and execution
- timing track write decisions (if/when/how), lock handling, and mutation safety
- command validation/apply/readback/rollback lifecycle
- no independent artistic direction unless explicitly delegated by user policy

Boundary rule:
- `designer_dialog` defines "what"; `sequence_agent` defines "how".
- If intent is ambiguous, `sequence_agent` must request clarification instead of inventing creative direction silently.

## 5) Orchestration Order
1. Sequence open/select.
2. Run `audio_analyst` to produce `analysis_handoff_v1`.
3. Run `designer_dialog` for guided intent + `intent_handoff_v1`.
4. Run `sequence_agent` for `plan_handoff_v1`.
5. Validate and apply using orchestration/safety contract.
6. Readback and diagnostics capture.

## 6) Failure Policy
- Missing/failed analysis blocks major mutation proposals unless user explicitly proceeds in reduced-confidence mode.
- Missing intent scope blocks apply.
- Failed validation blocks apply.
- Stale revision blocks apply and requires refresh/reproposal.
- Missing/ambiguous creative intent blocks sequence execution until clarified by `designer_dialog`.

## 7) Training Package Binding
- Training package modules stay as-is (`audio_track_analysis`, `lighting_design_principles`, `xlights_sequencer_execution`).
- Agent layer binds runtime roles to module assets.
- Canonical mapping should be represented by:
  - `training-packages/training-package-v1/agents/registry.json`
  - per-agent profile files under `training-packages/training-package-v1/agents/*.agent.json`

## 8) Acceptance Criteria
- Agent roles are explicit in spec and reflected in training package metadata.
- Handoff payloads are machine-validated and logged in diagnostics.
- Runtime flow enforces orchestration order and apply gates.
- Audio analysis can run without xLights connection.
- Timing-track creation is owned by `sequence_agent`, not `audio_analyst`.
