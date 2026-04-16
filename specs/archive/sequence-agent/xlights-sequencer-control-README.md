# xLights Sequencer Control + Agent Autonomy

Status: Archived
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11
Superseded By: `README.md`, `xlights-2026-06-api-migration-plan-2026-04-16.md`, `xlights-2026-06-api-compatibility-matrix-2026-04-16.md`

## Purpose
Define the full target contract between xLightsDesigner and xLights before further API implementation, with explicit boundaries and autonomous-agent execution requirements.

## Planning Note
- This set is archived historical context.
- It is not the active execution spine.
- Current execution is driven by the `2026.06` owned API migration set plus the active `sequence-agent/README.md`.

## Active Spec Set
- `xlights-sequencer-control-project-spec.md`: source-of-truth scope, requirements, and acceptance criteria.
- `xlights-sequencer-control-api-surface-contract.md`: required endpoint/capability matrix for full sequencer control.
- `../designer-dialog/designer-interaction-contract.md`: user-to-agent interaction and proposal/apply contract.
- `xlights-sequencer-control-agent-orchestration-architecture.md`: multi-agent role model, handoff contracts, and execution order.
- `xlights-sequencer-control-sequence-agent-implementation-checklist.md`: implementation checklist for `sequence_agent` planning/execution phases.
- `xlights-sequencer-control-decision-log.md`: locked decisions to minimize implementation churn.
- `xlights-sequencer-control-implementation-roadmap.md`: phase ordering and active execution sequence.
- `xlights-sequencer-control-architecture-reset-plan-2026-03-11.md`: authoritative architecture reset and execution gates.
- `xlights-sequencer-control-acceptance-test-matrix.md`: cross-domain acceptance tests.
- `xlights-sequencer-control-training-package-architecture.md`: portable BYO-provider training package architecture.
- `xlights-sequencer-control-integration-test-harness.md`: non-UI integration scripts and report contract.
- `xlights-sequencer-control-schemas-*.json` + `xlights-sequencer-control-schemas-README.md`: machine-readable schema contracts.
- `xlights-sequencer-control-test-fixtures.example.env` + `xlights-sequencer-control-test-fixtures.manifest.json`: fixture contract for harness execution.

## Archive
- Historical implementation-step artifacts (WP docs, prior wireframes, regression snapshots, gap audits, and earlier checklists) are in `specs/archive/`.

## Related Docs
- `docs/operations/xlightsdesigner-desktop-release-runbook.md`
- `docs/operations/xlightsdesigner-desktop-validation-evidence-log.md`
