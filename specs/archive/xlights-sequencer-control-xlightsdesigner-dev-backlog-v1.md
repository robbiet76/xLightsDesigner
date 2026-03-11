# xLightsDesigner Development Backlog v1

Status: Draft  
Date: 2026-03-04  
Source: `wireframes-v5.md`, `wireframes-v5-implementation-checklist.md`, `standalone-app-requirements.md`, `desktop-architecture-implementation-checklist.md`

## 1) Prioritization Model
- `P0`: required to deliver first usable internal build.
- `P1`: required for stable iterative workflow.
- `P2`: quality/completeness hardening.

## 2) Epic Plan

## E0: Desktop Runtime + Distribution Foundation (P0)
Goal: ensure the app runs and ships as a standalone packaged desktop application without side runtime installs.

Stories:
1. Establish packaged desktop runtime host + preload bridge contract.
2. Implement native file dialog + filesystem access boundary used by Sequence Setup.
3. Move persistence from browser-only storage to app config + disk-backed project stores.
4. Add startup compatibility gate and degraded mode behavior wiring.
5. Define build/sign/update pipeline scaffolding for macOS distribution.

Definition of done:
- App launches as desktop shell with bridge-backed file selection.
- Core flows run without requiring users to install Node/Python/Electron separately.

Dependencies:
- none

## E1: App Shell and Navigation (P0)
Goal: establish the global shell and deterministic navigation/state persistence.

Stories:
1. Build global layout shell (header, status bar, left nav, footer).
2. Implement route/state model for `Project`, `Design`, `History`, `Metadata`.
3. Implement global status bar message bus (`info`, `warning`, `action-required`).
4. Implement deep-link routing for `View Details`.

Definition of done:
- All screens accessible from left nav.
- Status bar visible and functional across screens.

Dependencies:
- none

## E2: Project Screen + Project Runtime Settings (P0)
Goal: make project/show binding and sequence session bootstrapping operational.

Stories:
1. Implement project summary card and show-folder binding.
2. Implement sequence workspace (`Open Sequence`, `Recent`, `New Session`).
3. Implement project-level settings panel (discovery, multi-instance, retry, backup).
4. Implement session actions (`Resume Last`, `Plan Only`, `Open in xLights`).
5. Persist/reload project settings.

Definition of done:
- One active sequence at a time enforced.
- Plan-only mode toggles no-apply behavior.

Dependencies:
- E1

## E3: Design Workspace + Draft Proposal Loop (P0)
Goal: deliver chat-to-proposal workflow on one screen.

Stories:
1. Implement chat thread UI and composer.
2. Implement intent controls (scope/range/models/mood/energy/priority/color constraints).
3. Implement live proposed-changes summary list (default 5 rows + show more).
4. Implement `Generate/Refresh` action.
5. Implement `Open Details` drawer.

Definition of done:
- Proposal summary updates from chat/intent changes.
- Missing detail supports artistic-license generation.

Dependencies:
- E1, E2

## E4: Apply Pipeline + Control-State Enforcement (P0)
Goal: safely apply draft changes to xLights from the Design workflow.

Stories:
1. Implement shared UI state flags (`xlightsConnected`, `activeSequenceLoaded`, `hasDraftProposal`, `proposalStale`, `applyInProgress`, `planOnlyMode`).
2. Implement control enable/disable rules for generate/apply/details/review/rollback.
3. Implement disabled-control reason messaging.
4. Implement apply action path with revision-token validation.
5. Implement stale-proposal block and user actions (`Rebase/Refresh`, `Regenerate`, `Cancel`).

Definition of done:
- No apply allowed with stale proposal.
- Apply button behavior is deterministic and explainable.

Dependencies:
- E2, E3

## E5: History + Versioned Rollback (P1)
Goal: support iterative collaboration with reliable version checkpoints.

Stories:
1. Implement version timeline list with summary counts.
2. Implement version detail panel.
3. Implement rollback flow (target select + confirm + rerender).
4. Implement compare/reapply-as-variant actions.

Definition of done:
- Every approved apply creates a version.
- Rollback to selected version succeeds and is reflected in status/history.

Dependencies:
- E4

## E6: Metadata Screen + Orphan Handling (P1)
Goal: support intent-focused semantic metadata without duplicating xLights model UI.

Stories:
1. Implement tag library (curated + user-extensible).
2. Implement model/group context assignment panel.
3. Implement orphaned metadata panel + detail drill-down.
4. Persist metadata edits to project/sequence stores.

Definition of done:
- Metadata round-trips correctly.
- Missing model identities are surfaced as orphaned.

Dependencies:
- E2

## E7: Proposal Details + Section Batching (P1)
Goal: expose optional detail-on-demand and section-based apply batching.

Stories:
1. Implement proposal details drawer with section grouping.
2. Implement expandable effect-level details.
3. Implement split-by-section apply path.

Definition of done:
- User can inspect deeper details without leaving Design flow.

Dependencies:
- E3, E4

## E8: Compact/Mobile Behavior (P2)
Goal: preserve feature parity in compact layouts.

Stories:
1. Implement tabbed compact Design layout (`Chat`, `Intent`, `Proposed`).
2. Implement fixed bottom apply action bar.
3. Implement full-height proposal detail sheet.

Definition of done:
- No functional control loss vs desktop.

Dependencies:
- E3, E4, E7

## E9: UX Copy and Threshold Finalization (P1)
Goal: lock remaining product inputs required for stable behavior.

Stories:
1. Finalize large-change threshold for extra apply confirmation.
2. Finalize stale/conflict messaging copy.
3. Finalize disabled-control reason strings.

Definition of done:
- Strings and thresholds are documented and implemented in constants/config.

Dependencies:
- E4

## E10: Test Harness for UI Workflow Gates (P1)
Goal: ensure repeatable verification of core user flows.

Stories:
1. Add automated tests for screen load/navigation/state persistence.
2. Add tests for apply gating and stale proposal blocking.
3. Add tests for history version creation and rollback.
4. Add tests for metadata orphan surfacing.

Definition of done:
- P0/P1 flows have deterministic pass/fail coverage.

Dependencies:
- E1-E6

## 3) Suggested Delivery Sequence
1. Sprint A: E0, E1
2. Sprint B: E2, E3
3. Sprint C: E4, E5
4. Sprint D: E6, E7, E9
5. Sprint E: E10, E8

## 4) Immediate “Start Now” Tickets
1. Finalize desktop runtime bridge contract and packaged host bootstrap.
2. Implement app-config and sequence-sidecar persistence abstraction.
3. Create app shell scaffold and route map.
4. Implement project/show binding with persistent storage.
5. Implement shared state store and apply button gating logic.

## 5) Blockers Check
No hard blockers for starting implementation.  
Soft blockers (can be resolved during Sprint B/C):
- large-change threshold value,
- final stale/conflict copy,
- final disabled-control copy.
