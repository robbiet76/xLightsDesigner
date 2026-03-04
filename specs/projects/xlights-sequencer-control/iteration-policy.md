# API Iteration Policy (Designer-First)

Status: Active  
Date: 2026-03-03

## Goal
Move from "full closure now" to a sustainable loop where xLightsDesigner feature work drives API refinements in small, safe increments.

## Working Model
1. Treat the current API/harness state as the integration baseline.
2. Build xLightsDesigner features against that baseline.
3. Capture API friction as backlog items (not ad-hoc one-offs).
4. Batch API changes on a regular cadence (weekly or sprint-based).
5. Keep regression risk low with required smoke checks.

## Required Guardrails
- Keep API changes scoped to `xLights/automation/**` unless explicitly approved.
- Preserve deterministic envelopes and error codes for all new/changed commands.
- Maintain non-interactive behavior for automation paths.
- Keep crash watcher enabled for live harness runs.

## Merge/Release Gates (Lightweight)
- Required before merging API changes:
  - `07-transactions-smoke.sh`
  - `08-plan-execution-smoke.sh`
  - Any suite directly affected by the change
- Required before tagged baseline updates:
  - full `run-all.sh` pass in a known-good live environment
  - status docs updated (`gap-audit`, `implementation-status-matrix`, `wp9-checklist`)

## Backlog Handling
- Use `designer-api-backlog.md` as the source of truth.
- Every new item should include:
  - user impact and severity
  - current workaround (if any)
  - acceptance condition
- Prioritize by unblock value to xLightsDesigner, not by theoretical completeness.

## Versioning Guidance
- Keep capability-driven behavior in Designer:
  - query `system.getCapabilities`
  - branch behavior by capability flags
- Avoid hard assumptions that all environments are on the latest API build.

## Definition of "Good Enough" During Iteration
- No known crashers on normal designer workflows.
- Deterministic failure modes for unsupported or invalid operations.
- Clear backlog coverage for known gaps.
