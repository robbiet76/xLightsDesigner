# WP-8 Spec: Fixture Pack Versioning + Bootstrap Portability

Status: Draft for execution  
Date: 2026-03-02  
Depends on: WP-7 completion

## 1) Objective
Define and ship a versioned fixture-pack contract so local and CI harness runs use the same deterministic inputs without manual interpretation.

## 2) Why WP-8 Exists
WP-7 closed endpoint/spec drift and established stable harness gates. The remaining gap is operational portability: fixture inputs are present, but not yet distributed as a versioned, reusable package.

## 3) In Scope
1. Fixture pack manifest/versioning model.
2. Bootstrap script contract for local/CI setup.
3. Integrity checks (required files, checksums, expected metadata).
4. Harness integration for explicit fixture-pack selection.
5. Documentation for agent/autonomous consumption.

## 4) Out of Scope
- New xLights API features.
- Expansion of command families beyond existing contract.
- UI-driven fixture setup workflows.

## 5) Requirements

### 5.1 Fixture Pack Contract
- Introduce fixture pack identifier fields (`packId`, `packVersion`) and source metadata.
- Define required assets (sequence/media/timing baselines) and optional assets.
- Include checksum metadata for deterministic verification.

### 5.2 Bootstrap Process
- Provide non-interactive bootstrap script that:
  - validates input paths and permissions
  - prepares/links fixture assets for smoke suites
  - emits machine-readable bootstrap report

### 5.3 Harness Integration
- `run-all.sh` must support explicit fixture pack selection.
- Summary output must include fixture pack id/version used for the run.

### 5.4 Agent/CI Compatibility
- CI can run with a known fixture pack ref without interactive prompts.
- Agent loops can detect fixture mismatch and stop with actionable errors.

## 6) Acceptance Criteria
1. Fixture pack schema/manifest fields are documented and validated.
2. Bootstrap script runs non-interactively and produces deterministic output.
3. Harness summary includes pack id/version.
4. CI/lint checks cover fixture bootstrap artifacts.
5. Docs are updated so a new environment can reproduce the same run conditions.

## 7) Deliverables
- `wp8-task-breakdown.md`
- Fixture pack schema/manifest updates
- Bootstrap script + usage docs
- Harness summary/report updates
- CI adjustments for fixture pack validation

## 8) Exit Definition
WP-8 is complete when fixture setup is versioned, scriptable, and reproducible across local and CI environments without manual intervention.
