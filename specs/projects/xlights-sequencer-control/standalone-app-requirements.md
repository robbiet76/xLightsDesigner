# Standalone App Requirements: xLightsDesigner

Status: Draft (Gap-Fill In Progress)  
Date: 2026-03-04  
Scope: Standalone xLightsDesigner application requirements (non-embedded, xLights-integrated)

## 1) Purpose
Consolidate standalone-app requirements already defined across specs and explicitly capture remaining requirement gaps for iterative completion.

This spec assumes:
- xLightsDesigner runs as a separate app/process.
- xLights remains the sequencing execution/editor system of record.
- Designer orchestrates intent, proposals, approval, and iterative collaboration.

## 2) Baseline (Already Defined)
- Director-console interaction model (no duplicate sequencer/timeline editing UI).
- Proposal/approval/change-set workflow with explicit user approval.
- Collaborative edit model with fresh-scan/rebase on user-side edits.
- Designer-led elicitation and clarification behavior.
- Chat-first intent-capture direction with agent-managed translation to structured scope/constraints.
- Learning + freshness loop concept (preference fit + novelty controls).
- Model context + semantic metadata concept.
- Semantic timing-track bridge concept for structure visibility in xLights.
- Standalone-first architecture (separate from xLights plugin/embedded distribution path).
- Initial creative analysis stage for new sequence setup (audio + lyrics + semantic interpretation).

## 3) Requirement Areas and Open Gaps

## 3.1 App Architecture and Runtime
Defined:
- Standalone process boundary.
- API-driven integration with xLights.

Gaps to define:
- runtime component model (UI shell, orchestration engine, local store, background workers),
- startup/shutdown lifecycle,
- offline/degraded behavior when xLights is unavailable,
- cache invalidation strategy.

TBD fields:
- `architecture.components`
- `runtime.lifecycle`
- `runtime.degradedModes`

## 3.2 xLights Connectivity Contract
Defined:
- refresh/revision awareness concept.

Gaps to define:
- attach/discovery UX for local xLights endpoints,
- reconnect/backoff behavior,
- behavior when multiple xLights instances are detected,
- compatibility handling across xLights versions.

TBD fields:
- `connect.discoveryPolicy`
- `connect.multiInstancePolicy`
- `connect.versionCompatibility`
- `connect.retryPolicy`

## 3.3 Session and Project Model
Defined:
- session memory concepts.

Gaps to define:
- distinction between Designer project and xLights sequence,
- save/open/autosave semantics for Designer-side state,
- backup/restore flows for Designer metadata and change history.

TBD fields:
- `project.model`
- `project.persistence`
- `project.backupRestore`

## 3.4 Proposal, Diff, and Approval UX
Defined:
- proposal object and approval actions.

Gaps to define:
- diff granularity and rendering rules,
- risk scoring thresholds that trigger additional confirmation,
- batching rules for large change sets.

TBD fields:
- `proposal.diffGranularity`
- `proposal.riskThresholds`
- `proposal.batchApprovalRules`

## 3.5 Collaborative Rebase/Conflict UX
Defined:
- fresh-scan requirement and triggers.

Gaps to define:
- user-facing conflict states and decision options,
- rebase vs regenerate rules by operation type,
- conflict recovery UX copy/flow.

TBD fields:
- `conflict.stateMachine`
- `conflict.rebasePolicy`
- `conflict.userActions`

## 3.6 UI Information Architecture
Defined:
- high-level panel set (chat/scope/constraints/proposal/history/learning).

Gaps to define:
- screen map and navigation model,
- default layout for desktop first,
- loading/empty/error state requirements for each panel.

TBD fields:
- `ui.screenMap`
- `ui.navigation`
- `ui.stateRequirements`

## 3.6.1 Intent Capture Contract (UI <-> Agent)
Defined:
- User intent may be specific or broad/subjective; chat is primary and always available.
- Agent is responsible for translating director-level language into executable design proposals.

Gaps to define:
- internal slot/tag schema for scope, mood, pacing, priority, constraints, and lock directives,
- adaptive question policy (when agent asks clarifying questions vs proceeds),
- traceability from captured intent inputs to generated proposal rationale.

TBD fields:
- `intent.schema`
- `intent.clarificationPolicy`
- `intent.traceability`

## 3.6.2 Initial Creative Analysis Contract (Sequence Setup)
Defined:
- During initial sequence setup, agent performs a creative analysis pass before first major proposal/apply.
- Stage includes a kickoff dialog where the user shares goals, desired style, and inspiration.
- Analysis inputs include:
  - audio track signal/features (structure, rhythm, dynamics, energy),
  - lyrics/text (themes, story arc, emotional cues),
  - user-supplied reference media (image, image set, or video) used as stylistic inspiration,
  - optional external context/inspiration research.

Required behavior:
- Produce a concise `Creative Brief` used to guide subsequent proposals:
  - user goals + inspiration summary,
  - section map,
  - mood/energy arc,
  - narrative/theme cues,
  - visual direction cues from reference media,
  - initial design direction hypotheses.
- Treat external research as optional enrichment, not a hard dependency.
- If external research is used, store source links/notes in internal traceability metadata.
- If user reference media is provided, retain reference ids/filenames and short interpretation notes in traceability metadata.
- Keep user control: user can accept/adjust/reject brief direction before large apply.

Gaps to define:
- which providers/services are used for lyrics and external context,
- accepted reference-media formats and size limits for uploads,
- prompt/template format for the creative brief,
- fallback behavior when lyrics or internet context are unavailable.

TBD fields:
- `analysis.creativeBriefSchema`
- `analysis.providerPolicy`
- `analysis.referenceMediaPolicy`
- `analysis.fallbackPolicy`
- `analysis.traceability`

## 3.7 Learning and Preference Governance
Defined:
- learning loop concepts and controls.

Gaps to define:
- per-user profile boundaries,
- retention and reset policy,
- export/import behavior for preference profiles,
- privacy constraints for stored feedback events.

TBD fields:
- `learning.profileBoundary`
- `learning.retentionPolicy`
- `learning.exportImport`
- `learning.privacyPolicy`

## 3.8 Model Semantic Metadata Operations
Defined:
- model context layers and merge precedence.

Gaps to define:
- metadata authoring workflows,
- taxonomy governance and validation,
- orphan resolution UX after model drift/rename/remove.

TBD fields:
- `modelMeta.authoringFlow`
- `modelMeta.validationRules`
- `modelMeta.orphanHandling`

## 3.9 Semantic Timing Track Governance
Defined:
- semantic track concept and label binding.

Gaps to define:
- track naming convention standard,
- ownership/lifecycle rules (create/update/archive/delete),
- collision policy when user-created tracks overlap semantics.

TBD fields:
- `semanticTracks.namingConvention`
- `semanticTracks.lifecyclePolicy`
- `semanticTracks.collisionPolicy`

## 3.10 Safety and Permission Model
Defined:
- explicit approval for apply.

Gaps to define:
- destructive action confirmation matrix,
- locked-region policy enforcement boundaries,
- rollback guarantees at app UX level.

TBD fields:
- `safety.confirmationMatrix`
- `safety.lockPolicy`
- `safety.rollbackUX`

## 3.10.1 Edit Stability and Iterative Preservation
Defined:
- User can iteratively direct changes (`change y to z`) without unintentionally rebuilding entire sequence sections.

Gaps to define:
- untouched-region preservation guarantees by operation type,
- allowable collateral-change thresholds and explicit warning thresholds,
- rollback granularity for partial proposal application.

TBD fields:
- `stability.preservationRules`
- `stability.collateralThresholds`
- `stability.rollbackGranularity`

## 3.11 Non-Functional Requirements (Standalone)
Defined:
- none beyond general deterministic behavior goals.

Gaps to define:
- UI responsiveness targets,
- reliability/error-budget targets,
- local resource constraints,
- startup and sync latency targets.

TBD fields:
- `nfr.performance`
- `nfr.reliability`
- `nfr.latency`
- `nfr.resourceLimits`

## 3.12 Release and Operations
Defined:
- standalone-first deployment decision.

Gaps to define:
- packaging/distribution channels,
- update policy,
- diagnostics bundle format,
- supportability workflow.

TBD fields:
- `ops.packaging`
- `ops.updatePolicy`
- `ops.diagnosticsBundle`
- `ops.supportWorkflow`

## 3.13 Verification and Test Strategy
Defined:
- API harness coverage for xLights control layer.

Gaps to define:
- standalone UX flow tests,
- long-session/state-recovery tests,
- learning-loop behavior validation tests.

TBD fields:
- `test.uxFlows`
- `test.stateRecovery`
- `test.learningValidation`

## 3.14 API Drift and Compatibility Safeguards
Defined:
- none yet at standalone-app governance level.

Gaps to define:
- contract-check cadence to detect xLights source/API behavior drift,
- failure policy when checks fail (block release, degrade feature set, warn-only modes),
- minimum compatibility matrix policy for supported xLights versions.

TBD fields:
- `compat.contractCheckCadence`
- `compat.failurePolicy`
- `compat.versionMatrixPolicy`

## 4) Suggested Phased Completion
1. Phase S1 (MVP viability): connectivity, session model, proposal UX, conflict UX, safety.
2. Phase S2 (quality): semantic metadata authoring, semantic track governance, NFR targets.
3. Phase S3 (adaptive maturity): learning governance, metrics and validation loops.

## 5) Next Editing Rule
When any `TBD` field is resolved, update:
- this file,
- related detailed spec (`designer-interaction-contract`, `learning-and-freshness-loop`, `model-context-and-semantic-metadata`),
- acceptance-test matrix if testable behavior changes.

## 6) Gap-Closure Decisions (Captured 2026-03-04)
Source: directed Q/A review with product owner.

Resolved / Partially Resolved:
- `connect.discoveryPolicy`:
  - production xLights expected in `/Applications`,
  - Designer should define the show folder,
  - media/show subpaths should be discovered from that show folder or from a required standard folder layout.
- `connect.multiInstancePolicy`: tentative default is newest/latest-running instance (marked tentative).
- `connect.versionCompatibility`: minimum supported xLights floor starts at `2026.1` (2025 line out of scope).
- `runtime.degradedModes`: allow planning-only mode when xLights is unavailable; no apply/mutation operations.
- `project.model`: editing unit is sequence-level; one sequence active at a time in Designer.
- `project.persistence`:
  - app-level config stored in app config location,
  - sequence metadata stored beside `.xsq` using same basename with Designer extension.
- `proposal.riskThresholds`: emphasize high-impact warnings, especially large delete operations.
- `conflict.rebasePolicy`: user should be asked whether to incorporate/rebase user edits before proceeding.
- `conflict.userActions`:
  - ask user on conflict,
  - later overwrite is still allowed when explicitly requested by user intent.
- `intent.schema`: initial required fields should include scope, time range, mood, energy, color constraints, priority, locked regions.
- `intent.clarificationPolicy`: ask minimum clarifying questions needed; absence of detail implies artistic license.
- `intent.traceability`: maintain traceability internally; deep trace output not required in default UI.
- `analysis.creativeBriefSchema`: include section map, mood/energy arc, lyric/theme cues, and initial design hypotheses.
- `analysis.fallbackPolicy`: if lyrics/external context are missing, continue with audio-only + user dialog; do not block.
- `stability.preservationRules`:
  - after initial sequence generation, treat regions as preserved unless user requests targeted/global changes,
  - support section-targeted edits via semantic timing labels (for example chorus-specific updates).
- `stability.rollbackGranularity`: treat each approved agent update as a version checkpoint (conversation-step versioning).
- `safety.lockPolicy`: no additional persistent lock model required initially.
- `safety.confirmationMatrix`: rely primarily on version rollback instead of expanded double-confirm matrix.
- `safety.rollbackUX`: rollback selects a prior Designer version target and re-renders (not instant undo).
- `ui.screenMap`: approved baseline screens.
- `ui.navigation`: left-rail navigation.
- `ui.stateRequirements`: no additional must-have states specified yet.
- `modelMeta.authoringFlow`: avoid replicating full xLights model-management UI; keep Designer UX intent-focused.
- `modelMeta.validationRules`: curated tags but extensible/user-curated over time.
- `modelMeta.orphanHandling`: key by stable model identity; missing identity becomes orphaned metadata.
- `semanticTracks.namingConvention`: prefix with `XD:` (examples: `XD: Mood`, `XD: Energy`).
- `semanticTracks.lifecyclePolicy`: both agent and user can create/update/delete (with user control always available).
- `semanticTracks.collisionPolicy`: ignore non-Designer timing tracks by default (no auto-merge/reuse).
- `learning.profileBoundary`: per project/show preference profile (not global-only).
- `compat.contractCheckCadence`: run compatibility check when xLights version changes.
- `compat.failurePolicy`: require update/remediation when compatibility check fails.
- `test.learningValidation`: success judged by user feedback on both freshness and quality (qualitative baseline).

Still Open:
- `nfr.performance`
- `nfr.reliability`
- `nfr.latency`
- `nfr.resourceLimits`
- `ops.packaging`
- `ops.updatePolicy`
- `ops.diagnosticsBundle`
- `ops.supportWorkflow`
- `test.uxFlows`
- `test.stateRecovery`
- `learning.retentionPolicy`
- `learning.exportImport`
- `learning.privacyPolicy`

Provisional Defaults (to be validated during early xLightsDesigner implementation):
- `connect.retryPolicy`:
  - retry intervals `1s, 2s, 5s, 10s, 15s`, then every `30s` until user cancels or reconnect succeeds.
- `project.backupRestore`:
  - automatic backup before every apply,
  - retain last `20` sequence-linked Designer versions per sequence.
- `proposal.diffGranularity`:
  - default `mixed` (summary by region/section with expandable per-effect details).
- `proposal.batchApprovalRules`:
  - small proposals: single approval action,
  - large/high-impact proposals: approval by section/risk bucket.
- `conflict.stateMachine`:
  - `clean -> stale_detected -> user_choice(rebase/regenerate/cancel) -> resolved`.
- `stability.collateralThresholds`:
  - warn when projected out-of-scope mutation exceeds `5%`,
  - require explicit confirmation when exceeding `15%`.
- `compat.versionMatrixPolicy`:
  - target support for latest `2026.x` minor plus previous two `2026.x` minors.
- `learning.retentionPolicy`:
  - retain project learning history by default for project lifetime,
  - allow user reset/clear at any time (manual reset control).
- `learning.exportImport`:
  - support export/import at project profile scope (portable between machines).
- `learning.privacyPolicy`:
  - do not store raw user chat transcripts in long-term preference profile by default,
  - store derived preference signals and explicit user feedback markers.
