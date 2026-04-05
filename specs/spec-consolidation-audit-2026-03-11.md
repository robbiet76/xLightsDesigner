# Spec Consolidation Audit (2026-03-11)

Status: Completed
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-05

Scope: `specs/` cleanup after flattening from project folders.

## Objective
Create a clean, maintainable active spec set and move step-specific historical documents out of the primary path.

## Result
- Active specs remain in `specs/` root.
- Historical/spec-iteration artifacts moved to `specs/archive/`.
- Readmes updated so active authority is explicit.

## Consolidation Decisions

### Kept Active (authoritative at the time)
- `audio-timing-lyrics-*` audio docs (now removed and superseded by `specs/audio-analyst/*`)
- `xlights-sequencer-control-project-spec.md`
- `xlights-sequencer-control-api-surface-contract.md`
- `xlights-sequencer-control-decision-log.md`
- `xlights-sequencer-control-implementation-roadmap.md`
- `xlights-sequencer-control-architecture-reset-plan-2026-03-11.md`
- `xlights-sequencer-control-acceptance-test-matrix.md`
- `xlights-sequencer-control-training-package-architecture.md`
- `xlights-sequencer-control-integration-test-harness.md`
- `xlights-sequencer-control-schemas-*.json`
- `xlights-sequencer-control-test-fixtures.example.env`
- `xlights-sequencer-control-test-fixtures.manifest.json`

### Archived (historical / superseded)
- PR-step and endpoint-mapping docs for audio phase
- WP7/WP8/WP9 step-level specs and checklists
- older wireframes (`v1/v3/v4/v5`) and associated implementation checklists
- one-time regression pass records and point-in-time audits
- interim backlog, gap-audit, and temporary testing registers
- prior strategy/checklist docs superseded by current runbook + roadmap

## Rationale
- Reduce active-surface ambiguity during implementation.
- Preserve history for traceability without mixing it into day-to-day source-of-truth.
- Keep scripts/contracts pointing to stable active files.
- Keep operational procedures/evidence in `docs/operations/` rather than `specs/`.

## Identified Spec Gaps
1. Missing explicit spec lifecycle metadata standard.
- Need required front-matter fields (`Status`, `Owner`, `Last Reviewed`, `Supersedes`, `Superseded By`).

2. Missing requirements-to-tests traceability map.
- Acceptance matrix exists, but there is no single requirements-to-automation-test crosswalk document.

3. Missing operational ownership split between app/spec areas.
- Need one short governance file defining where product requirements vs operational runbooks vs historical evidence should live.

4. Missing deprecation policy for legacy commands/contracts.
- Contracts describe capabilities, but deprecation cadence and compatibility windows are not centrally defined.

5. Missing formal release readiness gate checklist for agent quality.
- Desktop release runbook exists, but no single gate doc for model-quality thresholds (structure accuracy, lyric timing quality, service health thresholds).

## Recommended Next Additions
- `specs/spec-lifecycle-policy.md`
- `specs/requirements-traceability-matrix.md`
- `specs/agent-release-quality-gates.md`

## 2026-04-05 Note
This document records the March 2026 consolidation event. It is not the current execution spine.
Use `current-app-plan-2026-04-05.md` plus domain READMEs for the current active plan.
