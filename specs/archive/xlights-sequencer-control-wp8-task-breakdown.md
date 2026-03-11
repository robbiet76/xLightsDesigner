# WP-8 Task Breakdown

Status: Draft execution plan  
Date: 2026-03-02

## Task Group 1: Fixture Pack Contract
### T1.1 Extend fixture manifest with pack metadata
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Add `packId`, `packVersion`, `source`, and checksum fields.
- Done when:
  - Manifest validates and is backward-compatible with existing suite expectations.

### T1.2 Add fixture pack schema guardrails
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Add/extend JSON schema checks for fixture pack metadata and required assets.
- Done when:
  - Invalid pack definitions fail fast in lint/CI.

## Task Group 2: Bootstrap Automation
### T2.1 Create non-interactive bootstrap script
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Add `scripts/xlights-control/bootstrap-fixtures.sh`.
  - Validate required files and emit machine-readable bootstrap report.
- Done when:
  - A clean environment can prepare fixture inputs in one command.

### T2.2 Integrate bootstrap output with harness
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - `run-all.sh` consumes bootstrap report/pack metadata.
  - Summary includes `packId` and `packVersion`.
- Done when:
  - Reports unambiguously identify fixture inputs used.

## Task Group 3: CI + Docs
### T3.1 Add CI lint/validation for fixture pack artifacts
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Validate bootstrap script syntax and fixture pack schema.
- Done when:
  - CI fails on malformed fixture pack/bootstrap artifacts.

### T3.2 Update integration docs and autonomy requirements
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Document bootstrap flow and failure modes in harness/autonomy docs.
- Done when:
  - Agent/local operators can run fixture setup without ad hoc interpretation.

## Task Group 4: Closeout
### T4.1 Run end-to-end harness with explicit fixture pack
- Owner: both repos
- Status: Completed
- Done when:
  - run-all summary includes fixture pack metadata and deterministic pass/fail output.

### T4.2 Freeze WP-8 docs
- Owner: xLightsDesigner repo
- Done when:
  - WP-8 docs and scripts are internally consistent and linked from index docs.
