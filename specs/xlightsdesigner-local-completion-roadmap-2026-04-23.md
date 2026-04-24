# xLightsDesigner Local Completion Roadmap (2026-04-23)

Status: Active
Date: 2026-04-23
Owner: xLightsDesigner Team

## Current Phase

Phase 2 has started after a green owned-API proof and Phase 1 owned-path cleanup.

Validated against:
- xLights repo: `/Users/robterry/xLights-2026.06`
- show folder: `/Users/robterry/Documents/Lights/Current/Christmas/Show`
- evidence: `/Users/robterry/Documents/Lights/Current/Christmas/Show/_xlightsdesigner_api_validation/2026-04-24T01-13-58-788Z/owned-api-validation-result.json`

The proof created an isolated `.xsq`, applied a simple batch plan, rendered the current sequence, saved through the owned API, and produced the `.fseq` next to the isolated `.xsq`. It also confirmed the create flow no longer writes `owned-api-validation.fseq` into the global/root FSEQ folder.

Automation launch requirements discovered during Phase 1:
- launch the API-enabled xLights 2026.06 build, not `/Applications/xLights.app`
- use `-o` for automation launches so the pre-frame information dialog does not block API startup
- set `XLIGHTS_DESIGNER_TRUSTED_ROOTS` to include the active show folder for create/save validation

Owned-path cleanup completed after the green proof:
- native Review copy no longer describes apply execution as future work
- native apply no longer imports or passes legacy transaction helpers
- sequence orchestration no longer falls back from owned batch apply to legacy transactions
- shared JS API wrappers for `transactions.begin`, `transactions.commit`, and `transactions.rollback` were removed from active app imports
- active `scripts/xlights-control/run-all.sh` no longer runs legacy regression or transaction suites by default
- the UI dev proxy no longer exposes `/xlDoAutomation` or ports `49914`/`49913`
- the active UI health/readme copy now advertises owned `sequencing.applyBatchPlan` plus `jobs.get` instead of legacy `system.executePlan`/`system.validateCommands`
- the sequencer execution training-package contract now requires the owned batch apply model instead of transactions
- the old `scripts/xlights-control/run-all.sh` entry point now fails closed and redirects to owned validation instead of running legacy suites

Phase 2 native design authoring started:
- native Design now exposes editable design intent fields for goal, mood/style, target scope, constraints, references, and approval notes
- design intent persists as `nativeDesignIntent` in the active project snapshot
- native automation snapshots include the current design intent and dirty state
- Sequence and Review now read `nativeDesignIntent` as pending work even before generated proposal artifacts exist
- assistant context payloads include `designIntent` so the team chat and agent bridge can reason from native authoring state
- assistant action requests can update `nativeDesignIntent` through the same persistence path as the native editor
- Sequence can generate proposal artifacts from saved native design intent through the native direct proposal script
- Sequence blocks native proposal generation until audio and a target project sequence are selected
- Native automation can trigger proposal generation through the same Sequence path and reports generation state in snapshots
- Assistant action requests can trigger proposal generation after explicit user approval, using the same Sequence path
- Native direct proposal generation has an isolated artifact-writing regression test with mocked xLights responses
- Native direct proposal generation passes available xLights effect definitions into direct sequence orchestration
- Native direct proposal generation falls back to the repo-managed trained effect bundle when live effect definitions are unavailable
- Native review apply uses the same live-or-trained effect catalog when building the final sequence-agent plan
- Shared owned API wrappers expose trained effect definitions until xLights provides a live owned definitions route
- Browser effect-catalog refresh now allows owned endpoints to use the trained definition fallback
- Pending work treats generated section-plan proposals as actionable even when placements are synthesized during Review apply
- Review blocks apply until a canonical generated proposal with sequence commands exists
- successful native proposal generation now publishes an artifact-change signal so Design, Sequence, Review, History, and xLights session state refresh without navigation
- successful Review apply now publishes the same artifact-change signal so applied revisions and history become visible across the native app immediately
- native Review now includes an explicit apply preview built from generated effect placements or proposal lines
- native Review apply now copies the target `.xsq` into the project `artifacts/backups` folder before mutation and surfaces the backup path after apply
- native Review apply now renders through the owned API before render-sample capture so persisted render feedback can observe the applied revision

Phase 3 proof-loop bridge started:
- xLights 2026.06 branch `xld-2026.06-migration` documents `layout/scene`, `sequence/render-current`, and `sequence/render-samples` as owned render-feedback routes
- xLights 2026.06 smoke coverage now dispatches `layout/scene` and `sequence/render-samples` through the owned endpoint harness
- native automation review-artifact summaries now include apply-result backup and render-current fields for proof-loop validation
- native Review apply now runs owned readback checks and embeds `practical_sequence_validation_v1` in the apply result
- native Review success state and automation artifact summaries now expose practical-validation readback/design counts
- stale first-pass API compatibility and render-feedback probe docs were marked with current owned-branch status so they no longer read as open route work
- native History inspection now shows compact proof-chain lines for plan, apply-result, render-observation, and render-critique artifacts

## Purpose

Define the phased path from the current native macOS + owned xLights API implementation to a complete app for the first local operator workflow.

For this phase, "complete" means the app works for the primary local user. Distribution, shared cloud agent hosting, and multi-user release hardening come after the local workflow is reliable.

## Product Direction

The app is the local translation layer between trained agents and xLights.

The local app owns:
- native macOS workflow UX
- local project state
- xLights session state
- local show folder inspection
- local sequence file creation, mutation, render, save, review, and history

The agent backend eventually becomes shared cloud infrastructure:
- trained agents can continue improving centrally
- distributed app installs use the shared backend for intelligence
- local writes still happen through the user's app and xLights installation

## Non-Negotiables

- The active app shell is the native macOS app in `apps/xlightsdesigner-macos`.
- The active xLights integration is the owned API in `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner`.
- `/Applications/xLights.app` is not valid for owned API work unless it is replaced by an API-enabled build.
- Electron-era paths are reference only until deleted.
- No compatibility layer should be preserved unless it is actively carrying current functionality during replacement.
- Existing sequence subfolders in the active show folder are read-only validation fixtures unless the user explicitly selects one for editing.
- Phase 1 test writes may use a new isolated folder inside the show folder.
- Existing sequences in the show folder may be inspected for functionality validation, but are not training data.
- When touching specs or API docs, scan nearby related docs for stale route names, future-tense migration plans, removed fallback paths, and inactive transaction/legacy contracts; clean those claims in the same slice when the scope is clear.

## Phase 1: Local Owned API Reliability

Goal: prove the native app and scripts can safely create, apply, render, and save through the owned xLights 2026.06 API against the user's real show environment.

Scope:
- use the API-enabled 2026.06 xLights build
- validate `/health`, `/layout/models`, `/layout/scene`, `/sequence/create`, `/sequencing/apply-batch-plan`, `/sequence/render-current`, `/sequence/save`, and `/jobs/get`
- create only new validation artifacts under an isolated show-folder path such as `_xlightsdesigner_api_validation/<run-id>/`
- do not modify existing sequence subfolders
- remove or disable obsolete fallback paths after owned API validation is green
- update stale native UI copy that still describes implemented apply behavior as "not wired"

Exit criteria:
- an isolated validation sequence can be created in the active show folder
- a simple owned batch plan applies to a real layout model
- render-current produces a usable `.fseq`
- save completes through the owned API
- validation evidence is written to a run artifact
- native/app tests remain green after removing stale fallback assumptions

## Phase 2: Full Native Design Authoring

Goal: make the Design workflow first-class, not summary-only.

Scope:
- author and revise creative direction natively
- capture style, mood, constraints, target scope, references, and approval notes
- store design intent as project data
- feed design intent into sequence-agent handoff
- keep manual sequencing edits optional, not required

Exit criteria:
- the user can create and revise design intent without hand-editing artifacts
- sequencing can proceed from native design authoring state
- Review clearly shows what will be applied and why

## Phase 3: Sequencing Proof Loop

Goal: prove the local translation layer can turn reviewed design intent into xLights sequence changes with render feedback.

Scope:
- use existing show sequences as validation fixtures only
- stabilize layering calibration and mature sequence calibration on the current 2026.06 owned API
- validate target resolution, batch apply, render samples, layout scene, render-current, observation, critique, and revision

Exit criteria:
- production layering calibration runs without touching existing user sequences
- mature sequence validation reports are generated from current runner output
- sequence-agent quality gates are evidence-backed, not manually inferred

## Phase 4: Local App Completion

Goal: complete the app for the first local operator workflow.

Scope:
- Project -> Display -> Audio -> Design -> Sequence -> Review -> History works as one native flow
- xLights session state is obvious and actionable
- backup/restore behavior is explicit before destructive apply actions
- stale Electron-era and fallback code is deleted once no longer active
- requirements traceability and release gates reflect the actual app

Exit criteria:
- the primary user can complete a real sequencing workflow locally
- failures are understandable and recoverable
- local evidence exists for each release-quality gate

## Phase 5: Distribution And Shared Cloud Backend

Goal: turn the local tool into a distributable app with a shared AI backend.

Scope:
- package and sign the native macOS app
- define install/update flow for the required xLights owned API build or plugin mechanism
- move trained agent execution behind shared cloud services
- keep local xLights file writes local
- add account, entitlement, usage, and provider configuration as needed

Exit criteria:
- a non-developer user can install and run the app
- the app connects to the shared backend
- local sequence generation still happens through the local xLights translation layer
