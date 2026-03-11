# Desktop Update Channel Strategy (xLightsDesigner)

Status: Draft default (2026-03-05)
Owner: xLightsDesigner maintainers

## 1) Goals
- Ship xLightsDesigner as a standalone desktop app with low user friction.
- Keep compatibility with production xLights as a hard gate for mutate operations.
- Allow rapid iteration without forcing unstable builds onto production users.

## 2) Channels
- `stable`
  - Default for end users.
  - Receives fully validated releases only.
- `preview`
  - Optional opt-in channel for early adopters.
  - Used for candidate features before promotion to stable.

## 3) Versioning and Promotion
- Semantic app versioning: `MAJOR.MINOR.PATCH`.
- Promotion path:
  1. Build candidate in preview.
  2. Run release smoke and compatibility matrix checks.
  3. Promote same artifact lineage to stable when gates pass.

## 4) Compatibility Policy
- Minimum supported xLights floor: `2026.1`.
- On incompatibility:
  - Designer remains usable in plan-only mode.
  - Mutating actions remain blocked.
  - User receives actionable guidance to update Designer and/or xLights.

## 5) Update Behavior Defaults
- Check for updates on app startup and every 24h while running.
- If newer version exists:
  - Stable channel: prompt for update with release notes.
  - Preview channel: notify non-blocking, user chooses update timing.
- Critical compatibility/security fix:
  - Require update before mutate operations.
  - Allow plan-only mode until update applied.

## 6) Rollback Policy
- Keep at least one prior stable installer available to support rollback.
- Rollback is release-level only; sequence-level rollback remains backup-driven in app.

## 7) Telemetry/Diagnostics for Update Ops
- Record update check result, selected channel, current version, and last update time.
- Expose update diagnostics in exported diagnostics bundle for support.

## 8) Open Items
- Final updater provider/tooling implementation.
- Code-signing/notarization automation details.
- Preview enrollment UX wording and policy.
