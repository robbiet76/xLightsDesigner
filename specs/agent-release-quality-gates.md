# Agent Release Quality Gates

Status: Active
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose
Define go/no-go gates for shipping agent-enabled behavior.

## Gate Categories
1. Service Health
- Analysis service reachable.
- Required providers available per configured mode.

2. Audio Analysis Quality
- Beat/bar track generation succeeds on reference set.
- Structure track generated with no invalid timing bounds.
- Lyrics timing only written when synced timestamps are present.

3. Owned API And Contract Safety
- Owned xLights API boots on the active app/runtime path.
- Required sequence, layout, timing, media, and sequencing routes pass smoke validation.
- Validation gate enforced before apply.
- Revision guard blocks stale apply.
- Active metadata fingerprint is readable from the owned API.

4. Sequencer And Training Validation
- Sequencer validation matrix remains green for the active contract surfaces.
- Current training harness produces clean chunk validation for the in-scope model set.
- No unresolved blocking gaps remain in the active effectmetadata/import path.

5. Operational Readiness
- Native desktop release runbook executed where a release build is being cut.
- Historical Electron validation logs are not used as current release evidence.
- Current validation evidence is captured in active native/runtime artifacts, not retired shell logs.

## Evidence Inputs
- `specs/current-app-plan-2026-04-05.md`
- `specs/requirements-traceability-matrix.md`
- `specs/sequence-agent/xlights-2026-06-api-migration-plan-2026-04-16.md`
- `specs/sequence-agent/xlights-2026-06-api-compatibility-matrix-2026-04-16.md`
- `specs/sequence-agent/xlights-2026-06-owned-api-implementation-plan-2026-04-16.md`
- `specs/sequence-agent/sequencer-validation-matrix-2026-04-15.md`
- `specs/sequence-agent/sequencer-validation-audit-2026-04-15.md`
- `specs/sequence-agent/sequencer-training-reset-plan-2026-04-15.md`
- `specs/sequence-agent/sequencer-training-unattended-batch-harness-v1-2026-04-15.md`
- `apps/xlightsdesigner-ui/tests/api.test.js`
- `apps/xlightsdesigner-ui/tests/eval/run-live-practical-benchmark.test.js`
- `scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh`
- `docs/operations/xlightsdesigner-desktop-release-runbook.md`
- `docs/operations/xlightsdesigner-desktop-validation-evidence-log.md` (historical Electron path only)

## Current Interpretation

For the current product phase, a release-quality agent path requires:
- native macOS app path, not the retired Electron package path
- owned API validation on the active xLights runtime
- current effectmetadata import and drift detection in place
- green sequencer validation at the contract level
- green stage1 training/validation on the active xLights base

This document is a gate summary, not the detailed test plan.
The detailed acceptance surfaces live in the sequence-agent validation and `2026.06` migration specs.
