# Agent Release Quality Gates

Status: Draft
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

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

3. Agent Contract Safety
- Plan generation deterministic for fixed inputs.
- Validation gate enforced before apply.
- Revision guard blocks stale apply.

4. Operational Readiness
- Desktop release runbook executed.
- Evidence log updated for current build.

## Evidence Inputs
- `xlights-sequencer-control-acceptance-test-matrix.md`
- `xlights-sequencer-control-integration-test-harness.md`
- `docs/operations/xlightsdesigner-desktop-validation-evidence-log.md`
