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
- Owns media fingerprinting, timing extraction, lyrics/chords/section analysis, and evidence summary.
- Produces structured analysis handoff for downstream agents.

2. `designer_dialog`
- Owns user conversation, intent clarification, and creative-brief maintenance.
- Produces normalized intent and constraints for sequencing.

3. `sequencer_designer`
- Owns plan generation and apply-ready mutation construction.
- Uses safety gates and deterministic command builders before apply.

## 4) Handoff Contracts

### 4.1 `analysis_handoff_v1`
Producer: `audio_analyst`  
Consumers: `designer_dialog`, `sequencer_designer`

Required fields:
- `trackIdentity` (`title`, `artist`, optional `isrc`)
- `timing` (`bpm`, `timeSignature`, `beatsTrack`, `barsTrack`)
- `structure` (`sections[]`, `source`, `confidence`)
- `lyrics` (`hasSyncedLyrics`, `lyricsTrackName`)
- `chords` (`hasChords`, `chordsTrackName`, `confidence`)
- `briefSeed` (`tone`, `mood`, `story`, `designHints[]`)
- `evidence` (`serviceSummary`, `webValidationSummary`, `sources[]`)

### 4.2 `intent_handoff_v1`
Producer: `designer_dialog`  
Consumer: `sequencer_designer`

Required fields:
- `goal`
- `mode` (`create|revise|polish|analyze`)
- `scope` (`targetIds`, `tagNames`, `timeRangeMs`)
- `constraints` (`changeTolerance`, `preserve*`, `allowGlobalRewrite`)
- `directorPreferences` (`styleDirection`, `energyArc`, `focusElements`, `colorDirection`)
- `approvalPolicy` (`requiresExplicitApprove`, `elevatedRiskConfirmed`)

### 4.3 `plan_handoff_v1`
Producer: `sequencer_designer`  
Consumer: `orchestrator/apply pipeline`

Required fields:
- `planId`
- `summary`
- `estimatedImpact`
- `warnings[]`
- `commands[]`
- `baseRevision`
- `validationReady` (boolean)

## 5) Orchestration Order
1. Sequence open/select.
2. Run `audio_analyst` to produce `analysis_handoff_v1`.
3. Run `designer_dialog` for guided intent + `intent_handoff_v1`.
4. Run `sequencer_designer` for `plan_handoff_v1`.
5. Validate and apply using orchestration/safety contract.
6. Readback and diagnostics capture.

## 6) Failure Policy
- Missing/failed analysis blocks major mutation proposals unless user explicitly proceeds in reduced-confidence mode.
- Missing intent scope blocks apply.
- Failed validation blocks apply.
- Stale revision blocks apply and requires refresh/reproposal.

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
