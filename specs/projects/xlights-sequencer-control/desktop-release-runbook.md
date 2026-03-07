# Desktop Release Runbook (macOS-first)

Status: Draft operational runbook (2026-03-05)
Owner: xLightsDesigner maintainers

## 1) Scope
This runbook defines pre-release validation and release execution for xLightsDesigner standalone desktop builds.

## 2) Inputs Required
- Candidate commit SHA.
- Target channel (`preview` or `stable`).
- Target xLights compatibility floor (`2026.1+`).
- Signed/notarized packaging credentials (when signing pipeline is enabled).
- GitHub Actions workflow: `.github/workflows/xlightsdesigner-desktop-macos.yml`.
- Repository secrets for signed path:
  - `XLD_CSC_LINK`
  - `XLD_CSC_KEY_PASSWORD`
  - `XLD_APPLE_ID`
  - `XLD_APPLE_APP_SPECIFIC_PASSWORD`
  - `XLD_APPLE_TEAM_ID`

## 3) Build Steps
1. `cd apps/xlightsdesigner-desktop`
2. `npm install`
3. `npm run dist:mac` (zip artifact) or `npm run dist:dir` (unpacked artifact)
4. `npm run verify:bundle`
5. Verify artifact exists under `apps/xlightsdesigner-desktop/dist`.

## 4) Compatibility Matrix Validation
Minimum required matrix for promotion:
- macOS supported runtime environment.
- xLights `2026.1` (minimum floor) with mutate expected enabled.
- Latest tested xLights `2026.x` with mutate expected enabled.
- One intentionally below-floor xLights build (or mocked capability response) with mutate expected blocked.

For each matrix row:
1. Launch xLights.
2. Launch Designer build candidate.
3. Confirm capability/version health card values.
4. Confirm apply enablement/disablement matches expectation.

## 5) Release Smoke Flow (required)
Execute this end-to-end flow for each candidate build:
1. Install artifact (or launch unpacked app).
2. Launch app.
3. Connect to xLights endpoint (health green).
4. Open an existing sequence.
5. Generate proposal from chat intent.
6. Apply proposal (validate-first path).
7. Confirm pre-apply backup recorded.
8. Trigger restore from last backup and reopen sequence.
9. Confirm rollback restore completed without crash.
10. Confirm `Agent Apply Rollout Mode` behavior:
   - `full`: plan + apply available
   - `plan-only`: plan generation available, apply blocked
   - `disabled`: agent apply path blocked by rollout policy
11. Export diagnostics and verify `agentRun` payload includes:
   - rollout mode
   - proposal counts
   - preview command count/error
   - last backup path + sequence path
12. Confirm recent apply history is visible in diagnostics panel.

Expected outcome:
- No fatal errors/crashes.
- Mutating commands only when compatibility allows.
- Backup/restore deterministic path works.

## 6) Diagnostics Capture for Failures
If any step fails:
1. Export diagnostics bundle from app.
2. Capture xLights crash/output logs if present.
3. Record exact build SHA, channel, and xLights version.
4. File issue with reproduction steps and attach diagnostics.

## 7) Promotion Decision
Promote to target channel only when:
- Build artifact generated successfully.
- Matrix checks pass.
- Release smoke flow passes.
- No open P0/P1 regressions from this candidate.

## 8) Post-Release Checks
- Validate download/install path from user perspective.
- Run baseline launch validation script on target machine:
  - `scripts/desktop/validate-nondev-install.sh /Applications/xLightsDesigner.app`
- Verify update check behavior for the channel.
- Spot-check connect/open/apply on one live environment.
- Record evidence row:
  - `scripts/desktop/record-validation-evidence.sh ...`
- Run readiness check:
  - `scripts/desktop/check-desktop-readiness.sh`

## 9) Exit Criteria
Release is considered complete when:
- Artifact published to target channel.
- Release notes posted.
- Checklist updated with pass/fail evidence.
- Rollout mode behavior validated across `full`, `plan-only`, and `disabled`.
- Agent diagnostics export verified to contain `agentRun` context and apply history.
