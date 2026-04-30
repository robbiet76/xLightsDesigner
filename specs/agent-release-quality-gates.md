# Agent Release Quality Gates

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30

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
- Owned xLights API boots from the configured active local xLights runtime.
- Required sequence, layout, timing, media, render-feedback, and sequencing routes pass owned validation.
- Native apply uses the owned `sequencing.applyBatchPlan` path and fails closed when required preflight/readback fails.
- Revision guard blocks stale apply.
- Active metadata fingerprint is readable from the owned API.

4. Sequencer And Training Validation
- Sequencer validation matrix remains green for the active contract surfaces.
- Current training harness produces clean chunk validation for the in-scope model set.
- No unresolved blocking gaps remain in the active effectmetadata/import path.
- Proof-loop memory, drilldown, and retained validation gates have current evidence.

5. Operational Readiness
- Native desktop release runbook executed where a release build is being cut.
- Historical prototype-shell validation logs are not used as current release evidence.
- Current validation evidence is captured in active native/runtime artifacts, not retired shell logs.
- Native backup/restore and xLights session recovery paths have package test evidence.

## Evidence Inputs
- `specs/product-plan.md`
- `specs/local-completion-roadmap.md`
- `specs/requirements-traceability-matrix.md`
- `specs/sequence-agent/xlights-api.md`
- `specs/sequence-agent/render-training-knowledge.md`
- `specs/sequence-agent/sequencing-system.md`
- `apps/xlightsdesigner-macos/Tests/XLightsDesignerMacOSTests/ReviewScreenViewModelTests.swift`
- `apps/xlightsdesigner-macos/Tests/XLightsDesignerMacOSTests/XLightsSessionViewModelTests.swift`
- `scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh`
- active show folder `_xlightsdesigner_api_validation/<run-id>/owned-api-validation-result.json`
- `docs/operations/xlightsdesigner-native-release-runbook.md`
- `docs/operations/xlightsdesigner-native-validation-evidence-log.md`

## Current Interpretation

For the current local app completion workstream, a release-quality agent path requires:
- native macOS app path, not a retired prototype package path
- owned API validation on the active xLights runtime
- current effectmetadata import and drift detection in place
- green native package tests for backup/restore, session recovery, proposal generation, pending work, and review apply behavior
- green sequencer validation at the contract and retained proof-loop level
- green stage1 training/validation on the active xLights base

This document is a gate summary, not the detailed test plan.
The detailed acceptance surfaces live in the sequence-agent, native app, and xLights API specs.
